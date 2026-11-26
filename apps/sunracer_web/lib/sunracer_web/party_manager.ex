defmodule SunracerWeb.PartyManager do
  @moduledoc "Single-node, temporary parties with serialized membership and private delivery."
  use GenServer

  @capacity 6
  @invite_ms 60_000
  @reconnect_ms 300_000

  def start_link(opts), do: GenServer.start_link(__MODULE__, nil, name: Keyword.get(opts, :name, __MODULE__))
  def register(id, name, server \\ __MODULE__), do: GenServer.call(server, {:register, id, name})
  def action(action, server \\ __MODULE__), do: GenServer.call(server, {:action, action})

  @doc "Server-only read of the current party, independent of channel caller."
  def member_ids(id), do: GenServer.call(__MODULE__, {:member_ids, id})

  @impl true
  def init(_) do
    Process.send_after(self(), :sweep, 1_000)
    {:ok, %{pilots: %{}, connections: %{}, parties: %{}, invites: %{}}}
  end

  @impl true
  def handle_call({:register, id, name}, {pid, _}, state) do
    if Map.has_key?(state.connections, pid) do
      {:reply, {:error, "already_registered"}, state}
    else
      ref = Process.monitor(pid)
      pilot = Map.get(state.pilots, id, %{name: name, pids: MapSet.new(), offline_at: nil})
      pilot = %{pilot | name: name, pids: MapSet.put(pilot.pids, pid), offline_at: nil}
      next = %{state | pilots: Map.put(state.pilots, id, pilot),
                       connections: Map.put(state.connections, pid, {id, ref})}
      notify(state, next, pid)
      {:reply, {:ok, snapshot(next, id)}, next}
    end
  end

  def handle_call({:member_ids, id}, _from, state) do
    cleaned = prune(state)
    notify(state, cleaned)
    ids = case party_for(cleaned, id) do
      nil -> []
      party -> party.members
    end
    {:reply, ids, cleaned}
  end

  def handle_call({:action, action}, {pid, _}, state) do
    case Map.get(state.connections, pid) do
      {id, _} ->
        cleaned = prune(state)
        {reply, next} = perform(action, id, cleaned)
        notify(state, next)
        {:reply, reply, next}
      nil -> {:reply, {:error, "unauthorized"}, state}
    end
  end

  @impl true
  def handle_info({:DOWN, ref, :process, pid, _}, state) do
    case Map.get(state.connections, pid) do
      {id, ^ref} ->
        pilot = Map.fetch!(state.pilots, id)
        pids = MapSet.delete(pilot.pids, pid)
        pilot = %{pilot | pids: pids, offline_at: if(MapSet.size(pids) == 0, do: now(), else: nil)}
        next = %{state | pilots: Map.put(state.pilots, id, pilot),
                         connections: Map.delete(state.connections, pid)}
        notify(state, next)
        {:noreply, next}
      _ -> {:noreply, state}
    end
  end

  def handle_info(:sweep, state) do
    next = prune(state)
    notify(state, next)
    Process.send_after(self(), :sweep, 1_000)
    {:noreply, next}
  end

  defp now, do: System.monotonic_time(:millisecond)
  defp online?(state, id) do
    case Map.get(state.pilots, id) do
      %{pids: pids} -> MapSet.size(pids) > 0
      nil -> false
    end
  end

  defp party_for(state, id) do
    Enum.find_value(state.parties, fn {_, party} -> if id in party.members, do: party end)
  end

  defp snapshot(state, id) do
    party = case party_for(state, id) do
      nil -> nil
      party ->
        %{id: party.id, leader_id: party.leader_id,
          members: Enum.map(party.members, fn member ->
            %{pilot_id: member, pilot_name: Map.fetch!(state.pilots, member).name,
              online: online?(state, member)}
          end)}
    end
    invitation = case Map.get(state.invites, id) do
      nil -> nil
      invite -> Map.take(invite, [:id, :inviter_id, :inviter_name])
    end
    %{party: party, invitation: invitation}
  end

  defp notify(old, next, except \\ nil) do
    if old != next do
      for {id, pilot} <- next.pilots,
          current = snapshot(next, id),
          current != snapshot(old, id),
          pid <- pilot.pids, pid != except do
        send(pid, {:party_state, current})
      end
    end
    :ok
  end

  defp prune(state) do
    time = now()
    state = %{state | invites: Map.reject(state.invites, fn {_, invite} -> invite.expires <= time end)}
    expired = for {id, %{offline_at: at}} <- state.pilots,
      is_integer(at) and time - at >= @reconnect_ms, do: id
    Enum.reduce(expired, state, fn id, acc ->
      acc = remove_member(acc, id)
      %{acc | pilots: Map.delete(acc.pilots, id), invites: Map.delete(acc.invites, id)}
    end)
  end

  defp perform(:snapshot, id, state), do: {{:ok, snapshot(state, id)}, state}

  defp perform({:invite, target}, id, state) do
    party = party_for(state, id)
    cond do
      target == id or not online?(state, target) or party_for(state, target) != nil ->
        {{:error, "recipient_unavailable"}, state}
      party != nil and party.leader_id != id ->
        {{:error, "leader_required"}, state}
      party != nil and length(party.members) >= @capacity ->
        {{:error, "party_full"}, state}
      Map.has_key?(state.invites, target) ->
        {{:error, "recipient_unavailable"}, state}
      true ->
        party = party || %{id: System.unique_integer([:positive, :monotonic]), leader_id: id, members: [id]}
        outstanding = Enum.count(state.invites, fn {_, inv} -> inv.party_id == party.id end)
        if outstanding >= @capacity - length(party.members) do
          {{:error, "party_full"}, state}
        else
          invite = %{id: System.unique_integer([:positive, :monotonic]), party_id: party.id,
            inviter_id: id, inviter_name: Map.fetch!(state.pilots, id).name, expires: now() + @invite_ms}
          next = %{state | parties: Map.put(state.parties, party.id, party),
                           invites: Map.put(Map.delete(state.invites, id), target, invite)}
          {:ok, next}
        end
    end
  end

  defp perform({:accept, token}, id, state) do
    with %{id: ^token, party_id: party_id, inviter_id: inviter_id} <- Map.get(state.invites, id),
         %{leader_id: ^inviter_id, members: members} = party <- Map.get(state.parties, party_id),
         true <- length(members) < @capacity,
         nil <- party_for(state, id) do
      {:ok, %{state | parties: Map.put(state.parties, party_id, %{party | members: members ++ [id]}),
                       invites: Map.delete(state.invites, id)}}
    else
      _ -> {{:error, "invitation_unavailable"}, state}
    end
  end

  defp perform({:decline, token}, id, state) do
    case Map.get(state.invites, id) do
      %{id: ^token} -> {:ok, %{state | invites: Map.delete(state.invites, id)}}
      _ -> {{:error, "invitation_unavailable"}, state}
    end
  end

  defp perform(:leave, id, state), do: {:ok, remove_member(state, id)}

  defp perform({:remove, target}, id, state) do
    case party_for(state, id) do
      %{leader_id: ^id, members: members} when id != target ->
        if target in members, do: {:ok, remove_member(state, target)}, else: {{:error, "not_a_member"}, state}
      _ -> {{:error, "leader_required"}, state}
    end
  end

  defp perform({:transfer, target}, id, state) do
    case party_for(state, id) do
      %{leader_id: ^id, members: members} = party when id != target ->
        if target in members and online?(state, target) do
          {:ok, %{state | parties: Map.put(state.parties, party.id, %{party | leader_id: target}),
                           invites: cancel_invites(state, party.id)}}
        else
          {{:error, "not_a_member"}, state}
        end
      _ -> {{:error, "leader_required"}, state}
    end
  end

  defp perform({:message, text}, id, state) do
    case party_for(state, id) do
      nil -> {{:error, "not_in_party"}, state}
      party ->
        message = %{party_id: party.id, pilot_id: id, pilot_name: Map.fetch!(state.pilots, id).name,
          text: text, sent_at: DateTime.utc_now() |> DateTime.to_iso8601()}
        for member <- party.members, pid <- Map.fetch!(state.pilots, member).pids do
          send(pid, {:party_message, message})
        end
        {:ok, state}
    end
  end

  defp perform(_, _, state), do: {{:error, "invalid_action"}, state}

  defp cancel_invites(state, party_id), do: Map.reject(state.invites, fn {_, inv} -> inv.party_id == party_id end)

  defp remove_member(state, id) do
    case party_for(state, id) do
      nil -> state
      party ->
        members = List.delete(party.members, id)
        cond do
          members == [] ->
            %{state | parties: Map.delete(state.parties, party.id), invites: cancel_invites(state, party.id)}
          party.leader_id == id ->
            leader = Enum.find(members, &online?(state, &1)) || hd(members)
            %{state | parties: Map.put(state.parties, party.id, %{party | members: members, leader_id: leader}),
                      invites: cancel_invites(state, party.id)}
          true ->
            %{state | parties: Map.put(state.parties, party.id, %{party | members: members})}
        end
    end
  end
end

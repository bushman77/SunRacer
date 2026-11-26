defmodule SunracerWeb.PartyChatChannel do
  use SunracerWeb, :channel
  alias Sunracer.Accounts
  alias SunracerWeb.{ChatLimiter, ChatMessage, PartyManager, PilotPresence}

  @impl true
  def join("chat:party", _payload,
           %{assigns: %{socket_role: :pilot, current_player_id: id, current_pilot_name: name}} = socket)
      when is_integer(id) and is_binary(name) do
    case Process.whereis(PartyManager) do
      nil -> {:error, %{reason: "party_unavailable"}}
      manager ->
        ref = Process.monitor(manager)
        case PartyManager.register(id, name) do
          {:ok, snapshot} ->
            send(self(), :after_join)
            {:ok, snapshot, assign(socket, :party_manager_ref, ref)}
          {:error, reason} -> {:error, %{reason: reason}}
        end
    end
  end

  def join(_, _, _), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_info(:after_join, socket) do
    {:ok, _} = PilotPresence.track(socket, to_string(socket.assigns.current_player_id),
      %{pilot_name: socket.assigns.current_pilot_name})
    push(socket, "presence_state", PilotPresence.list(socket))
    {:noreply, socket}
  end

  def handle_info({:party_state, snapshot}, socket) do
    push(socket, "party_state", snapshot)
    {:noreply, socket}
  end

  def handle_info({:party_message, message}, socket) do
    unless message.pilot_id in Accounts.chat_ignored_ids(socket.assigns.current_player_id) do
      push(socket, "party_message", message)
    end
    {:noreply, socket}
  end

  def handle_info({:DOWN, ref, :process, _pid, _}, %{assigns: %{party_manager_ref: ref}} = socket),
    do: {:stop, :party_manager_restarted, socket}

  def handle_info(_, socket), do: {:noreply, socket}

  @impl true
  def handle_in("invite", %{"pilot_name" => name}, socket) when is_binary(name) do
    id = socket.assigns.current_player_id
    with true <- ChatLimiter.allow?(id),
         %{id: target} when target != id <- Accounts.get_chat_pilot(name),
         false <- blocked?(id, target) do
      reply(PartyManager.action({:invite, target}), socket)
    else
      false -> reply({:error, "rate_limited"}, socket)
      _ -> reply({:error, "recipient_unavailable"}, socket)
    end
  end

  def handle_in("accept", %{"invitation_id" => token}, socket) when is_integer(token) do
    id = socket.assigns.current_player_id
    with {:ok, %{invitation: %{id: ^token, inviter_id: inviter}}} <- PartyManager.action(:snapshot),
         false <- blocked?(id, inviter) do
      reply(PartyManager.action({:accept, token}), socket)
    else
      _ -> reply({:error, "invitation_unavailable"}, socket)
    end
  end

  def handle_in("decline", %{"invitation_id" => token}, socket) when is_integer(token),
    do: reply(PartyManager.action({:decline, token}), socket)

  def handle_in("leave", _, socket), do: reply(PartyManager.action(:leave), socket)

  def handle_in(event, %{"pilot_id" => target}, socket)
      when event in ["remove", "transfer"] and is_integer(target) do
    action = if event == "remove", do: :remove, else: :transfer
    if ChatLimiter.allow?(socket.assigns.current_player_id),
      do: reply(PartyManager.action({action, target}), socket),
      else: reply({:error, "rate_limited"}, socket)
  end

  def handle_in("send_message", %{"text" => raw}, socket) when is_binary(raw) do
    with {:ok, text} <- ChatMessage.validate_text(raw),
         true <- ChatLimiter.allow?(socket.assigns.current_player_id) do
      reply(PartyManager.action({:message, text}), socket)
    else
      false -> reply({:error, "rate_limited"}, socket)
      {:error, reason} -> reply({:error, reason}, socket)
    end
  end

  def handle_in(_, _, socket), do: reply({:error, "invalid_action"}, socket)

  defp blocked?(a, b), do: b in Accounts.chat_ignored_ids(a) or a in Accounts.chat_ignored_ids(b)
  defp reply(:ok, socket), do: {:reply, :ok, socket}
  defp reply({:error, reason}, socket), do: {:reply, {:error, %{reason: reason}}, socket}
end

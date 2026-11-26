defmodule SunracerWeb.GuildChatChannel do
  use SunracerWeb, :channel
  alias Sunracer.{Accounts, Guilds}
  alias SunracerWeb.{ChatLimiter, ChatMessage}

  defp inbox(id), do: "guild_comms:#{id}"

  @impl true
  def join("chat:guild", _payload, %{assigns: %{socket_role: :pilot, current_player_id: id, current_pilot_name: name}} = socket)
      when is_integer(id) and is_binary(name) do
    :ok = Phoenix.PubSub.subscribe(Sunracer.PubSub, inbox(id))
    {:ok, Guilds.snapshot(id), socket}
  end
  def join(_, _, _), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_in("send_message", %{"text" => raw}, socket) when is_binary(raw) do
    id = socket.assigns.current_player_id
    with {:ok, text} <- ChatMessage.validate_text(raw),
         true <- ChatLimiter.allow?(id),
         {:ok, guild_id, recipients} <- Guilds.chat_audience(id) do
      message = Map.put(ChatMessage.build(socket, text), :guild_id, guild_id)
      for recipient <- recipients do
        :ok = Phoenix.PubSub.broadcast(Sunracer.PubSub, inbox(recipient.pilot_id),
          {:guild_message, recipient.pilot_id, recipient.membership_id, message})
      end
      {:reply, :ok, socket}
    else
      false -> action_reply({:error, "rate_limited"}, socket)
      {:error, reason} -> action_reply({:error, reason}, socket)
    end
  end

  def handle_in("refresh", _, socket),
    do: {:reply, {:ok, Guilds.snapshot(socket.assigns.current_player_id)}, socket}

  def handle_in(event, payload, socket) do
    id = socket.assigns.current_player_id
    case command(event, payload) do
      nil -> action_reply({:error, "invalid_action"}, socket)
      action ->
        if ChatLimiter.allow?(id) do
          case Guilds.action(id, action) do
            {:ok, ids} ->
              for pilot_id <- Enum.uniq([id | ids]) do
                :ok = Phoenix.PubSub.broadcast(Sunracer.PubSub, inbox(pilot_id), {:guild_changed, pilot_id})
              end
              {:reply, {:ok, Guilds.snapshot(id)}, socket}
            {:error, reason} -> action_reply({:error, reason}, socket)
          end
        else
          action_reply({:error, "rate_limited"}, socket)
        end
    end
  end

  defp command("create", %{"name" => name}), do: {:create, name}
  defp command("invite", %{"pilot_name" => name}), do: {:invite, name}
  defp command("accept", %{"invitation_id" => id}), do: {:accept, id}
  defp command("decline", %{"invitation_id" => id}), do: {:decline, id}
  defp command("leave", _), do: :leave
  defp command("remove", %{"pilot_id" => id}), do: {:remove, id}
  defp command("rank", %{"pilot_id" => id, "rank" => rank}), do: {:rank, id, rank}
  defp command("transfer", %{"pilot_id" => id}), do: {:transfer, id}
  defp command(_, _), do: nil

  @impl true
  def handle_info({:guild_changed, id}, %{assigns: %{current_player_id: id}} = socket) do
    push(socket, "guild_state", Guilds.snapshot(id))
    {:noreply, socket}
  end

  def handle_info({:guild_message, id, membership_id, message}, %{assigns: %{current_player_id: id}} = socket) do
    if Guilds.current_member?(id, message.guild_id, membership_id) &&
       message.pilot_id not in Accounts.chat_ignored_ids(id) do
      push(socket, "guild_message", message)
    end
    {:noreply, socket}
  end

  def handle_info(_, socket), do: {:noreply, socket}
  defp action_reply({:error, reason}, socket), do: {:reply, {:error, %{reason: reason}}, socket}
end

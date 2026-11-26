defmodule SunracerWeb.DirectChatChannel do
  use SunracerWeb, :channel

  alias Sunracer.Accounts
  alias SunracerWeb.{ChatLimiter, ChatMessage}

  # Internal PubSub names are never client-joinable socket topics.
  defp inbox(id), do: "pilot_comms:#{id}"

  @impl true
  def join("chat:direct", _payload,
           %{assigns: %{socket_role: :pilot, current_player_id: id, current_pilot_name: name}} = socket)
      when is_integer(id) and is_binary(name) do
    :ok = Phoenix.PubSub.subscribe(Sunracer.PubSub, inbox(id))
    {:ok, %{ignored_ids: Accounts.chat_ignored_ids(id)}, socket}
  end

  def join(_topic, _payload, _socket), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_in("send_tell", %{"recipient" => name, "text" => raw}, socket)
      when is_binary(name) and is_binary(raw) do
    id = socket.assigns.current_player_id

    # Charge attempts before lookup to limit account enumeration and DB work.
    with {:ok, text} <- ChatMessage.validate_text(raw),
         true <- ChatLimiter.allow?(id),
         %{id: other_id, pilot_name: other_name} <- Accounts.get_chat_pilot(name),
         true <- other_id != id || {:error, "recipient_unavailable"},
         false <- blocked?(id, other_id) do
      message = ChatMessage.build(socket, text)
        |> Map.merge(%{recipient_id: other_id, recipient_name: other_name})

      :ok = Phoenix.PubSub.broadcast(Sunracer.PubSub, inbox(other_id), {:direct_tell, other_id, message})
      :ok = Phoenix.PubSub.broadcast(Sunracer.PubSub, inbox(id), {:direct_tell, id, message})
      # Accepted for live delivery, not a recipient read/delivery receipt.
      {:reply, :ok, socket}
    else
      false -> {:reply, {:error, %{reason: "rate_limited"}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
      _ -> {:reply, {:error, %{reason: "recipient_unavailable"}}, socket}
    end
  end

  def handle_in("set_ignore", %{"pilot_name" => name, "ignored" => ignored}, socket)
      when is_binary(name) and is_boolean(ignored) do
    id = socket.assigns.current_player_id

    with true <- ChatLimiter.allow?(id),
         %{id: other_id} when other_id != id <- Accounts.get_chat_pilot(name),
         {:ok, ids} <- Accounts.set_chat_ignored(id, other_id, ignored) do
      :ok = Phoenix.PubSub.broadcast(Sunracer.PubSub, inbox(id), {:ignore_changed, id, ids})
      {:reply, {:ok, %{ignored_ids: ids}}, socket}
    else
      false -> {:reply, {:error, %{reason: "rate_limited"}}, socket}
      _ -> {:reply, {:error, %{reason: "ignore_unavailable"}}, socket}
    end
  end

  def handle_in(_event, _payload, socket),
    do: {:reply, {:error, %{reason: "invalid_message"}}, socket}

  @impl true
  def handle_info({:direct_tell, id, message}, %{assigns: %{current_player_id: id}} = socket) do
    # Recheck on receipt in case the target blocked the sender while in flight.
    unless id != message.pilot_id and message.pilot_id in Accounts.chat_ignored_ids(id) do
      push(socket, "direct_tell", message)
    end
    {:noreply, socket}
  end

  def handle_info({:ignore_changed, id, ids}, %{assigns: %{current_player_id: id}} = socket) do
    push(socket, "ignore_changed", %{ignored_ids: ids})
    {:noreply, socket}
  end

  def handle_info(_event, socket), do: {:noreply, socket}

  defp blocked?(a, b) do
    b in Accounts.chat_ignored_ids(a) or a in Accounts.chat_ignored_ids(b)
  end
end

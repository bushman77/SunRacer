defmodule SunracerWeb.GlobalChatChannel do
  use SunracerWeb, :channel

  alias SunracerWeb.{ChatLimiter, ChatMessage}

  @impl true
  def join("chat:global", _payload, %{assigns: %{socket_role: :pilot,
      current_player_id: id, current_pilot_name: name}} = socket)
      when not is_nil(id) and is_binary(name) do
    {:ok, socket}
  end

  def join(_topic, _payload, _socket), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_in("send_message", %{"text" => raw}, socket) when is_binary(raw) do
    with {:ok, text} <- ChatMessage.validate_text(raw),
         true <- ChatLimiter.allow?(socket.assigns.current_player_id) do
      message = ChatMessage.build(socket, text)

      broadcast!(socket, "chat_message", message)
      {:reply, :ok, socket}
    else
      false -> {:reply, {:error, %{reason: "rate_limited"}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  def handle_in(_event, _payload, socket),
    do: {:reply, {:error, %{reason: "invalid_message"}}, socket}

end

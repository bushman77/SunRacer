defmodule SunracerWeb.GlobalChatChannel do
  use SunracerWeb, :channel

  alias SunracerWeb.ChatLimiter

  @max_chars 280
  @max_bytes 1120

  @impl true
  def join("chat:global", _payload, %{assigns: %{socket_role: :pilot,
      current_player_id: id, current_pilot_name: name}} = socket)
      when not is_nil(id) and is_binary(name) do
    {:ok, socket}
  end

  def join(_topic, _payload, _socket), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_in("send_message", %{"text" => raw}, socket) when is_binary(raw) do
    with {:ok, text} <- validate_text(raw),
         true <- ChatLimiter.allow?(socket.assigns.current_player_id) do
      message = %{
        pilot_name: socket.assigns.current_pilot_name,
        text: text,
        sent_at: DateTime.utc_now() |> DateTime.to_iso8601()
      }

      broadcast!(socket, "chat_message", message)
      {:reply, :ok, socket}
    else
      false -> {:reply, {:error, %{reason: "rate_limited"}}, socket}
      {:error, reason} -> {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  def handle_in(_event, _payload, socket),
    do: {:reply, {:error, %{reason: "invalid_message"}}, socket}

  defp validate_text(raw) when byte_size(raw) <= @max_bytes do
    if String.valid?(raw) do
      # Single-line chat; reject control characters, including terminal escapes.
      text = String.trim(raw)

      if text != "" and String.length(text) <= @max_chars and
           not Regex.match?(~r/[\x00-\x1f\x7f-\x9f]/u, raw) do
        {:ok, text}
      else
        {:error, "invalid_message"}
      end
    else
      {:error, "invalid_message"}
    end
  end

  defp validate_text(_raw), do: {:error, "invalid_message"}
end

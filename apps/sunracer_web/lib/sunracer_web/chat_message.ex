defmodule SunracerWeb.ChatMessage do
  @moduledoc "Shared text validation and authenticated chat message metadata."
  @max_chars 280
  @max_bytes 1120

  def build(socket, text) do
    %{
      pilot_id: socket.assigns.current_player_id,
      pilot_name: socket.assigns.current_pilot_name,
      text: text,
      sent_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  def validate_text(raw) when byte_size(raw) <= @max_bytes do
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

  def validate_text(_raw), do: {:error, "invalid_message"}
end

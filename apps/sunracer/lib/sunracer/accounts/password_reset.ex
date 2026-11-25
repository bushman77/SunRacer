defmodule Sunracer.Accounts.PasswordReset do
  @moduledoc "Hashed, expiring, one-use password recovery with per-account mail limits."

  @lifetime 30 * 60
  @window 24 * 60 * 60

  def issue(previous, now) do
    token = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    within = within_window?(previous, now)

    record = %{
      "hash" => digest(token),
      "expires_at" => now + @lifetime,
      "requested_at" => now,
      "window_started_at" => if(within, do: previous["window_started_at"], else: now),
      "count" => if(within, do: (previous["count"] || 0) + 1, else: 1)
    }

    {record, token}
  end

  def allowed?(previous, now) do
    last = previous["requested_at"]
    (not is_integer(last) or now - last >= 60) and
      (not within_window?(previous, now) or (previous["count"] || 0) < 5)
  end

  def valid?(%{"hash" => expected, "expires_at" => expiry}, token, now)
      when is_binary(expected) and byte_size(expected) == 64 and
           is_binary(token) and byte_size(token) == 43 and is_integer(expiry) do
    now < expiry and :crypto.hash_equals(expected, digest(token))
  end

  def valid?(_, _, _), do: false

  def consume(record), do: Map.drop(record, ["hash", "expires_at"])

  defp within_window?(record, now) do
    start = record["window_started_at"]
    is_integer(start) and now - start < @window
  end

  defp digest(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)
end

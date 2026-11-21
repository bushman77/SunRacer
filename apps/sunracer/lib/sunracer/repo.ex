defmodule Sunracer.Repo do
  use Ecto.Repo,
    otp_app: :sunracer,
    adapter: Ecto.Adapters.Postgres
end

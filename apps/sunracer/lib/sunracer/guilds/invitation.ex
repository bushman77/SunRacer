defmodule Sunracer.Guilds.Invitation do
  use Ecto.Schema

  schema "guild_invitations" do
    field :guild_id, :integer
    field :pilot_id, :integer
    field :inviter_id, :integer
    field :expires_at, :utc_datetime
    timestamps()
  end
end

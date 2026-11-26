defmodule Sunracer.Guilds.Membership do
  use Ecto.Schema

  schema "guild_memberships" do
    field :guild_id, :integer
    field :pilot_id, :integer
    field :rank, :string, default: "member"
    timestamps()
  end
end

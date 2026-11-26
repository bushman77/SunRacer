defmodule Sunracer.Guilds.Guild do
  use Ecto.Schema
  import Ecto.Changeset

  schema "guilds" do
    field :name, :string
    field :name_key, :string
    field :leader_id, :integer
    timestamps()
  end

  def changeset(guild, name) do
    guild
    |> change(name: name, name_key: String.downcase(name))
    |> validate_required([:name, :name_key, :leader_id])
    |> validate_length(:name, min: 3, max: 32)
    |> validate_format(:name, ~r/^[A-Za-z0-9][A-Za-z0-9 _-]*$/)
    |> unique_constraint(:name_key)
    |> unique_constraint(:leader_id)
  end
end

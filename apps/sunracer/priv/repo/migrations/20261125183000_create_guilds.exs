defmodule Sunracer.Repo.Migrations.CreateGuilds do
  use Ecto.Migration

  def change do
    create table(:guilds) do
      add :name, :string, size: 32, null: false
      add :name_key, :string, size: 32, null: false
      add :leader_id, references(:player_accounts, on_delete: :delete_all), null: false
      timestamps()
    end
    create unique_index(:guilds, [:name_key])
    create unique_index(:guilds, [:leader_id])

    create table(:guild_memberships) do
      add :guild_id, references(:guilds, on_delete: :delete_all), null: false
      add :pilot_id, references(:player_accounts, on_delete: :delete_all), null: false
      add :rank, :string, null: false, default: "member"
      timestamps()
    end
    create unique_index(:guild_memberships, [:pilot_id])
    create index(:guild_memberships, [:guild_id])
    create constraint(:guild_memberships, :guild_rank_valid, check: "rank IN ('officer', 'member')")

    create table(:guild_invitations) do
      add :guild_id, references(:guilds, on_delete: :delete_all), null: false
      add :pilot_id, references(:player_accounts, on_delete: :delete_all), null: false
      add :inviter_id, references(:player_accounts, on_delete: :delete_all), null: false
      add :expires_at, :utc_datetime, null: false
      timestamps()
    end
    create unique_index(:guild_invitations, [:pilot_id])
    create index(:guild_invitations, [:guild_id])
  end
end

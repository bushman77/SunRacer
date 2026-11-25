defmodule Sunracer.Repo.Migrations.AddPlayerPasswordReset do
  use Ecto.Migration

  def change do
    alter table(:player_accounts) do
      add :password_reset, :map, null: false, default: %{}
    end
  end
end

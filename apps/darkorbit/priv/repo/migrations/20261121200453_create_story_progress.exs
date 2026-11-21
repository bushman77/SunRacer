defmodule Darkorbit.Repo.Migrations.CreateStoryProgress do
  use Ecto.Migration

  def change do
    # One row per pilot and chapter. Steps only advance from server-confirmed
    # events (Darkorbit.Story); the row lock serialises concurrent events.
    create table(:story_progress) do
      add :user_id, references(:player_accounts, on_delete: :delete_all), null: false
      add :chapter, :string, null: false
      add :step, :integer, null: false, default: 1
      add :flags, :map, null: false, default: %{}
      add :skipped, :boolean, null: false, default: false
      add :step_started_at, :utc_datetime_usec, null: false
      add :step_times, :map, null: false, default: %{}
      add :completed_at, :utc_datetime_usec
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:story_progress, [:user_id, :chapter])

    create constraint(:story_progress, :story_progress_step_range,
             check: "step >= 1 AND step <= 10"
           )

    # Once-only story payouts (the cargo-claim receipt pattern): the unique
    # index makes a second payout for the same reward impossible.
    create table(:story_rewards) do
      add :user_id, references(:player_accounts, on_delete: :delete_all), null: false
      add :reward_id, :string, null: false
      add :credits, :integer, null: false
      add :details, :map, null: false, default: %{}
      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:story_rewards, [:user_id, :reward_id])
    create constraint(:story_rewards, :story_rewards_credits_non_negative, check: "credits >= 0")
  end
end

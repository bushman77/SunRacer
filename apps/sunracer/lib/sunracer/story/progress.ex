defmodule Sunracer.Story.Progress do
  @moduledoc "One pilot's position in a story chapter. Written only by Sunracer.Story."
  use Ecto.Schema

  schema "story_progress" do
    field :chapter, :string
    field :step, :integer, default: 1
    field :flags, :map, default: %{}
    field :skipped, :boolean, default: false
    field :step_started_at, :utc_datetime_usec
    field :step_times, :map, default: %{}
    field :completed_at, :utc_datetime_usec
    belongs_to :user, Sunracer.Accounts.PlayerAccount, foreign_key: :user_id
    timestamps(type: :utc_datetime_usec)
  end
end

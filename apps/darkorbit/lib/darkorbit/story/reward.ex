defmodule Darkorbit.Story.Reward do
  @moduledoc "Once-only receipt for a story payout (unique per pilot and reward)."
  use Ecto.Schema

  schema "story_rewards" do
    field :reward_id, :string
    field :credits, :integer
    field :details, :map, default: %{}
    belongs_to :user, Darkorbit.Accounts.PlayerAccount, foreign_key: :user_id
    timestamps(type: :utc_datetime_usec)
  end
end

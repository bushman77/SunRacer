defmodule SunracerWeb.PartyChatChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  import Sunracer.AccountsFixtures
  alias SunracerWeb.{GameAuth, PartyChatChannel, UserSocket}
  @endpoint SunracerWeb.Endpoint

  setup tags do
    Sunracer.DataCase.setup_sandbox(tags)
    :ok
  end

  test "only authenticated pilots join; no arbitrary party topic" do
    helmet = socket(UserSocket, "helmet", %{socket_role: :helmet, helmet_player_id: 1})
    assert {:error, %{reason: "unauthorized"}} = subscribe_and_join(helmet, PartyChatChannel, "chat:party")
    account = verified_player_account_fixture()
    {:ok, pilot} = connect(UserSocket, %{"token" => GameAuth.socket_token(account)})
    assert {:ok, %{party: nil, invitation: nil}, channel} = subscribe_and_join(pilot, PartyChatChannel, "chat:party")
    assert_push "presence_state", %{}
    ref = push(channel, "send_message", %{"text" => "not a member", "party_id" => 999})
    assert_reply ref, :error, %{reason: "not_in_party"}
    refute_broadcast "party_message", %{}
    assert {:error, %{reason: "unauthorized"}} = subscribe_and_join(pilot, PartyChatChannel, "chat:party:999")
  end
end

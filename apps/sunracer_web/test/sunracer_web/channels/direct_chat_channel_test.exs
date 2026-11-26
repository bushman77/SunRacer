defmodule SunracerWeb.DirectChatChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  import Sunracer.AccountsFixtures

  alias Sunracer.Accounts
  alias SunracerWeb.{GameAuth, DirectChatChannel, UserSocket}
  @endpoint SunracerWeb.Endpoint

  setup tags do
    Sunracer.DataCase.setup_sandbox(tags)
    :ok
  end

  defp join_pilot(account) do
    {:ok, socket} = connect(UserSocket, %{"token" => GameAuth.socket_token(account)})
    {:ok, _, channel} = subscribe_and_join(socket, DirectChatChannel, "chat:direct")
    channel
  end

  test "tells route exclusively to sender and recipient private inboxes" do
    first = verified_player_account_fixture()
    second = verified_player_account_fixture()
    third = verified_player_account_fixture()
    sender = join_pilot(first)
    _receiver = join_pilot(second)
    _third = join_pilot(third)
    for id <- [first.id, second.id, third.id] do
      :ok = Phoenix.PubSub.subscribe(Sunracer.PubSub, "pilot_comms:#{id}")
    end
    ref = push(sender, "send_tell", %{"recipient" => second.pilot_name, "text" => "Private",
      "pilot_id" => third.id, "pilot_name" => "Forged"})
    assert_reply ref, :ok
    a = first.id
    b = second.id
    c = third.id
    assert_receive {:direct_tell, ^b, %{pilot_id: ^a, recipient_id: ^b, text: "Private"}}
    assert_receive {:direct_tell, ^a, %{pilot_id: ^a, recipient_id: ^b, text: "Private"}}
    refute_receive {:direct_tell, ^c, _}
    refute_broadcast "direct_tell", %{}
  end

  test "ignoring persists and blocks tells in both directions" do
    first = verified_player_account_fixture()
    second = verified_player_account_fixture()
    receiver = join_pilot(second)
    sender = join_pilot(first)
    ref = push(receiver, "set_ignore", %{"pilot_name" => first.pilot_name, "ignored" => true})
    assert_reply ref, :ok, %{ignored_ids: ids}
    assert first.id in ids
    assert first.id in Accounts.chat_ignored_ids(second.id)
    ref = push(sender, "send_tell", %{"recipient" => second.pilot_name, "text" => "Blocked"})
    assert_reply ref, :error, %{reason: "recipient_unavailable"}
    refute_push "direct_tell", %{}
    ref = push(receiver, "set_ignore", %{"pilot_name" => first.pilot_name, "ignored" => false})
    assert_reply ref, :ok, %{ignored_ids: []}
    ref = push(sender, "send_tell", %{"recipient" => second.pilot_name, "text" => "Allowed"})
    assert_reply ref, :ok
    assert_push "direct_tell", %{text: "Allowed"}
  end

  test "helmet cannot join direct chat" do
    helmet = socket(UserSocket, "helmet", %{socket_role: :helmet, helmet_player_id: 1})
    assert {:error, %{reason: "unauthorized"}} =
      subscribe_and_join(helmet, DirectChatChannel, "chat:direct")
  end
end

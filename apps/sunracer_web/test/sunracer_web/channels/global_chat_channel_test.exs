defmodule SunracerWeb.GlobalChatChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  import Sunracer.AccountsFixtures

  alias SunracerWeb.{GameAuth, GlobalChatChannel, UserSocket}
  @endpoint SunracerWeb.Endpoint

  setup tags do
    Sunracer.DataCase.setup_sandbox(tags)
    :ok
  end

  defp pilot_socket(account) do
    {:ok, socket} = connect(UserSocket, %{"token" => GameAuth.socket_token(account)})
    {:ok, _, channel} = subscribe_and_join(socket, GlobalChatChannel, "chat:global")
    channel
  end

  test "global chat is available to authenticated pilots and ignores forged sender fields" do
    first = verified_player_account_fixture()
    second = verified_player_account_fixture()
    sender = pilot_socket(first)
    _receiver = pilot_socket(second)
    ref = push(sender, "send_message", %{"text" => "Hello Sol!", "pilot_name" => "Admin"})
    assert_reply ref, :ok
    assert_broadcast "chat_message", %{pilot_name: name, text: "Hello Sol!", sent_at: timestamp}
    assert name == first.pilot_name
    assert is_binary(timestamp)
    assert_push "chat_message", %{pilot_name: ^name, text: "Hello Sol!"}
  end

  test "helmet credentials and unauthenticated sockets cannot join" do
    helmet = socket(UserSocket, "helmet", %{socket_role: :helmet, helmet_player_id: 1})
    assert {:error, %{reason: "unauthorized"}} =
      subscribe_and_join(helmet, GlobalChatChannel, "chat:global")
    anonymous = socket(UserSocket, "anonymous", %{})
    assert {:error, %{reason: "unauthorized"}} =
      subscribe_and_join(anonymous, GlobalChatChannel, "chat:global")
  end

  test "rejects malformed, empty, oversized and control-character messages" do
    sender = pilot_socket(verified_player_account_fixture())
    for payload <- [%{}, %{"text" => 1}, %{"text" => "  "},
                    %{"text" => String.duplicate("x", 281)}, %{"text" => "a\nb"}] do
      ref = push(sender, "send_message", payload)
      assert_reply ref, :error, %{reason: "invalid_message"}
    end
    refute_broadcast "chat_message", %{}
  end

  test "flood protection follows the pilot rather than the channel" do
    account = verified_player_account_fixture()
    sender = pilot_socket(account)
    for _ <- 1..4 do
      ref = push(sender, "send_message", %{"text" => "test"})
      assert_reply ref, :ok
    end
    # ChannelTest links the channel to this test process. An intentional
    # leave exits with {:shutdown, :left}; observe it rather than letting
    # that expected exit terminate the test before the reconnect assertion.
    channel_pid = sender.channel_pid
    Process.unlink(channel_pid)
    monitor = Process.monitor(channel_pid)
    ref = leave(sender)
    assert_reply ref, :ok
    assert_receive {:DOWN, ^monitor, :process, ^channel_pid, {:shutdown, :left}}
    rejoined = pilot_socket(account)
    ref = push(rejoined, "send_message", %{"text" => "fifth"})
    assert_reply ref, :error, %{reason: "rate_limited"}
  end
end

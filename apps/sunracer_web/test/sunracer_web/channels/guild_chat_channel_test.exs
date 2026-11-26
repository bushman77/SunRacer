defmodule SunracerWeb.GuildChatChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  import Sunracer.AccountsFixtures
  alias Sunracer.Guilds
  alias SunracerWeb.{GameAuth, GuildChatChannel, UserSocket}
  @endpoint SunracerWeb.Endpoint

  setup tags do
    Sunracer.DataCase.setup_sandbox(tags)
    :ok
  end

  defp join_pilot(account) do
    {:ok, socket} = connect(UserSocket, %{"token" => GameAuth.socket_token(account)})
    {:ok, _, channel} = subscribe_and_join(socket, GuildChatChannel, "chat:guild")
    channel
  end

  test "guild chat is private and excludes removed members and forged identities" do
    a = verified_player_account_fixture()
    b = verified_player_account_fixture()
    c = verified_player_account_fixture()
    assert {:ok, _} = Guilds.action(a.id, {:create, "Solar Guard"})
    assert {:ok, _} = Guilds.action(a.id, {:invite, b.pilot_name})
    %{invitation: %{id: token}} = Guilds.snapshot(b.id)
    assert {:ok, _} = Guilds.action(b.id, {:accept, token})
    sender = join_pilot(a)
    _receiver = join_pilot(b)
    outsider = join_pilot(c)
    for id <- [a.id,b.id,c.id], do: Phoenix.PubSub.subscribe(Sunracer.PubSub, "guild_comms:#{id}")
    aid = a.id
    bid = b.id
    cid = c.id
    ref = push(sender, "send_message", %{"text" => "Private guild", "pilot_id" => cid, "guild_id" => 0})
    assert_reply ref, :ok
    assert_receive {:guild_message, ^aid, _, %{pilot_id: ^aid, text: "Private guild"}}
    assert_receive {:guild_message, ^bid, _, %{pilot_id: ^aid, text: "Private guild"}}
    refute_receive {:guild_message, ^cid, _, _}
    refute_broadcast "guild_message", %{}
    assert {:ok, _} = Guilds.action(a.id, {:remove, b.id})
    ref = push(sender, "send_message", %{"text" => "After removal"})
    assert_reply ref, :ok
    assert_receive {:guild_message, ^aid, _, %{text: "After removal"}}
    refute_receive {:guild_message, ^bid, _, %{text: "After removal"}}
    ref = push(outsider, "send_message", %{"text" => "Denied"})
    assert_reply ref, :error, %{reason: "not_in_guild"}
  end

  test "helmet cannot join guild chat" do
    helmet = socket(UserSocket, "helmet", %{socket_role: :helmet, helmet_player_id: 1})
    assert {:error, %{reason: "unauthorized"}} = subscribe_and_join(helmet, GuildChatChannel, "chat:guild")
  end
end

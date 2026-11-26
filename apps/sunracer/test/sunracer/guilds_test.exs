defmodule Sunracer.GuildsTest do
  use Sunracer.DataCase, async: false
  import Sunracer.AccountsFixtures
  alias Sunracer.{Guilds, Accounts}

  test "persistent membership, unique name, invitations and rank authority" do
    a = verified_player_account_fixture()
    b = verified_player_account_fixture()
    c = verified_player_account_fixture()
    assert {:ok, _} = Guilds.action(a.id, {:create, "Nova Fleet"})
    assert {:error, "guild_name_taken"} = Guilds.action(b.id, {:create, "nova fleet"})
    assert {:error, "already_in_guild"} = Guilds.action(a.id, {:create, "Other Fleet"})
    assert {:ok, _} = Guilds.action(a.id, {:invite, b.pilot_name})
    %{invitation: %{id: token}} = Guilds.snapshot(b.id)
    assert {:error, "invitation_unavailable"} = Guilds.action(c.id, {:accept, token})
    assert {:ok, _} = Guilds.action(b.id, {:accept, token})
    assert %{guild: %{rank: "member", members: [_, _]}} = Guilds.snapshot(b.id)
    assert {:error, "officer_required"} = Guilds.action(b.id, {:invite, c.pilot_name})
    assert {:ok, _} = Guilds.action(a.id, {:rank, b.id, "officer"})
    assert {:ok, _} = Guilds.action(b.id, {:invite, c.pilot_name})
    %{invitation: %{id: token}} = Guilds.snapshot(c.id)
    assert {:ok, _} = Guilds.action(c.id, {:accept, token})
    assert {:error, "leader_required"} = Guilds.action(b.id, {:remove, a.id})
    assert {:error, "transfer_leadership_first"} = Guilds.action(a.id, :leave)
    assert {:ok, _} = Guilds.action(a.id, {:transfer, b.id})
    assert %{guild: %{rank: "leader"}} = Guilds.snapshot(b.id)
    assert {:ok, _} = Guilds.action(b.id, {:remove, c.id})
    assert %{guild: nil} = Guilds.snapshot(c.id)
    assert {:ok, _} = Guilds.action(a.id, :leave)
    assert {:ok, _} = Guilds.action(b.id, :leave)
    assert %{guild: nil} = Guilds.snapshot(b.id)
    assert {:ok, _} = Guilds.action(c.id, {:create, "Nova Fleet"})
  end

  test "audience identifies exact memberships; ignoring blocks invitations" do
    a = verified_player_account_fixture()
    b = verified_player_account_fixture()
    c = verified_player_account_fixture()
    assert {:ok, _} = Guilds.action(a.id, {:create, "Sol Watch"})
    assert {:ok, _} = Accounts.set_chat_ignored(b.id, a.id, true)
    assert {:error, "recipient_unavailable"} = Guilds.action(a.id, {:invite, b.pilot_name})
    assert {:ok, _} = Accounts.set_chat_ignored(b.id, a.id, false)
    assert {:ok, _} = Guilds.action(a.id, {:invite, b.pilot_name})
    %{invitation: %{id: token}} = Guilds.snapshot(b.id)
    assert {:ok, _} = Guilds.action(b.id, {:accept, token})
    assert {:ok, guild_id, audience} = Guilds.chat_audience(a.id)
    assert Enum.sort(Enum.map(audience, & &1.pilot_id)) == Enum.sort([a.id, b.id])
    recipient = Enum.find(audience, &(&1.pilot_id == b.id))
    assert Guilds.current_member?(b.id, guild_id, recipient.membership_id)
    assert {:ok, _} = Guilds.action(a.id, {:remove, b.id})
    refute Guilds.current_member?(b.id, guild_id, recipient.membership_id)
    assert {:error, "not_in_guild"} = Guilds.chat_audience(c.id)
    assert {:ok, _} = Guilds.action(a.id, {:invite, b.pilot_name})
    %{invitation: %{id: token}} = Guilds.snapshot(b.id)
    assert {:ok, _} = Guilds.action(b.id, {:accept, token})
    refute Guilds.current_member?(b.id, guild_id, recipient.membership_id)
  end
end

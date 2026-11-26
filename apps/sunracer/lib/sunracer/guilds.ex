defmodule Sunracer.Guilds do
  @moduledoc """
  Persistent player organizations, independent of NPC faction and party state.
  A transaction-scoped PostgreSQL advisory lock serializes guild mutations,
  including cross-guild membership races. Database unique constraints backstop
  one membership and one outstanding invitation per pilot.
  """
  import Ecto.Query
  alias Sunracer.{Accounts, Repo}
  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.Guilds.{Guild, Membership, Invitation}

  @capacity 50
  @invite_seconds 604_800
  @lock_key 726514032

  def snapshot(id) do
    # A single statement for the membership lookup, then a bounded roster.
    guild = case membership(id) do
      nil -> nil
      member ->
        case Repo.get(Guild, member.guild_id) do
          nil -> nil
          guild ->
            %{id: guild.id, name: guild.name, leader_id: guild.leader_id,
              rank: rank(member, guild), members: roster(guild)}
        end
    end

    now = utc_now()
    invitation = Repo.one(from i in Invitation,
      join: g in Guild, on: g.id == i.guild_id,
      join: a in PlayerAccount, on: a.id == i.inviter_id,
      where: i.pilot_id == ^id and i.expires_at > ^now,
      select: %{id: i.id, guild_id: g.id, guild_name: g.name,
        inviter_name: a.pilot_name, expires_at: i.expires_at})
    %{guild: guild, invitation: invitation}
  end

  def action(id, command) when is_integer(id) do
    Repo.transaction(fn ->
      # Initial scale is a single small world; a global guild-write lock is
      # deliberately conservative and never taken on physics or chat delivery.
      Ecto.Adapters.SQL.query!(Repo, "SELECT pg_advisory_xact_lock($1::bigint)", [@lock_key])
      perform(id, command)
    end)
  end

  @doc "Returns current sender guild and exact recipient membership identities."
  def chat_audience(id) do
    # One SQL statement gives a consistent membership snapshot. Recipient
    # channels also verify their exact membership ID before pushing.
    rows = Repo.all(from sender in Membership,
      join: recipient in Membership, on: recipient.guild_id == sender.guild_id,
      where: sender.pilot_id == ^id,
      select: %{guild_id: sender.guild_id, pilot_id: recipient.pilot_id,
        membership_id: recipient.id})
    case rows do
      [] -> {:error, "not_in_guild"}
      [%{guild_id: guild_id} | _] -> {:ok, guild_id, rows}
    end
  end

  def current_member?(pilot_id, guild_id, membership_id) do
    Repo.exists?(from m in Membership,
      where: m.pilot_id == ^pilot_id and m.guild_id == ^guild_id and m.id == ^membership_id)
  end

  defp membership(id), do: Repo.get_by(Membership, pilot_id: id)
  defp utc_now, do: DateTime.utc_now() |> DateTime.truncate(:second)
  defp rank(member, guild), do: if(member.pilot_id == guild.leader_id, do: "leader", else: member.rank)

  defp roster(guild) do
    rows = Repo.all(from m in Membership,
      join: a in PlayerAccount, on: a.id == m.pilot_id,
      where: m.guild_id == ^guild.id, order_by: [asc: m.id],
      select: %{pilot_id: m.pilot_id, pilot_name: a.pilot_name, rank: m.rank})
    Enum.map(rows, fn m -> if m.pilot_id == guild.leader_id, do: %{m | rank: "leader"}, else: m end)
  end

  defp member_ids(guild_id), do: Repo.all(from m in Membership, where: m.guild_id == ^guild_id, select: m.pilot_id)
  defp invite_ids(guild_id), do: Repo.all(from i in Invitation, where: i.guild_id == ^guild_id, select: i.pilot_id)
  defp affected(guild_id), do: Enum.uniq(member_ids(guild_id) ++ invite_ids(guild_id))
  defp fail(reason), do: Repo.rollback(reason)
  defp get_guild(id) do
    case membership(id) do
      nil -> fail("not_in_guild")
      member -> {member, Repo.get!(Guild, member.guild_id)}
    end
  end

  defp require_leader(id, guild) do
    if guild.leader_id != id, do: fail("leader_required")
  end
  defp require_recruiter(member, guild) do
    unless rank(member, guild) in ["leader", "officer"], do: fail("officer_required")
  end
  defp blocked?(a, b), do: b in Accounts.chat_ignored_ids(a) or a in Accounts.chat_ignored_ids(b)
  defp clear_invite(id), do: Repo.delete_all(from i in Invitation, where: i.pilot_id == ^id)

  defp perform(id, {:create, raw}) when is_binary(raw) and byte_size(raw) <= 128 do
    if membership(id), do: fail("already_in_guild")
    if not String.valid?(raw), do: fail("invalid_guild_name")
    name = String.trim(raw)
    guild = case Repo.insert(Guild.changeset(%Guild{leader_id: id}, name)) do
      {:ok, guild} -> guild
      {:error, changeset} ->
        if Keyword.has_key?(changeset.errors, :name_key), do: fail("guild_name_taken"), else: fail("invalid_guild_name")
    end
    Repo.insert!(%Membership{guild_id: guild.id, pilot_id: id})
    clear_invite(id)
    [id]
  end

  defp perform(id, {:invite, name}) when is_binary(name) do
    {member, guild} = get_guild(id)
    require_recruiter(member, guild)
    target = case Accounts.get_chat_pilot(name) do
      %{id: target} when target != id -> target
      _ -> fail("recipient_unavailable")
    end
    if membership(target) || blocked?(id, target), do: fail("recipient_unavailable")
    now = utc_now()
    Repo.delete_all(from i in Invitation, where: i.expires_at <= ^now)
    if Repo.get_by(Invitation, pilot_id: target), do: fail("recipient_unavailable")
    if length(member_ids(guild.id)) + length(invite_ids(guild.id)) >= @capacity, do: fail("guild_full")
    Repo.insert!(%Invitation{guild_id: guild.id, pilot_id: target, inviter_id: id,
      expires_at: DateTime.add(now, @invite_seconds, :second)})
    [target]
  end

  defp perform(id, {:accept, token}) when is_integer(token) do
    if membership(id), do: fail("already_in_guild")
    now = utc_now()
    invite = Repo.one(from i in Invitation,
      where: i.id == ^token and i.pilot_id == ^id and i.expires_at > ^now) || fail("invitation_unavailable")
    inviter = membership(invite.inviter_id)
    guild = Repo.get!(Guild, invite.guild_id)
    unless inviter && inviter.guild_id == guild.id && rank(inviter, guild) in ["leader", "officer"] &&
      not blocked?(id, invite.inviter_id), do: fail("invitation_unavailable")
    if length(member_ids(guild.id)) >= @capacity, do: fail("guild_full")
    Repo.insert!(%Membership{guild_id: guild.id, pilot_id: id})
    clear_invite(id)
    member_ids(guild.id)
  end

  defp perform(id, {:decline, token}) when is_integer(token) do
    case Repo.get_by(Invitation, id: token, pilot_id: id) do
      nil -> fail("invitation_unavailable")
      invite -> Repo.delete!(invite); [id]
    end
  end

  defp perform(id, :leave) do
    {member, guild} = get_guild(id)
    ids = affected(guild.id)
    if guild.leader_id == id do
      if length(member_ids(guild.id)) > 1, do: fail("transfer_leadership_first")
      Repo.delete!(guild)
    else
      revoke_invites(guild.id, id)
      Repo.delete!(member)
    end
    ids
  end

  defp perform(id, {:remove, target}) when is_integer(target) and target != id do
    {actor, guild} = get_guild(id)
    require_recruiter(actor, guild)
    member = target_member(target, guild)
    if rank(member, guild) == "leader" || (rank(actor, guild) == "officer" && member.rank == "officer"),
      do: fail("leader_required")
    ids = affected(guild.id)
    revoke_invites(guild.id, target)
    Repo.delete!(member)
    ids
  end

  defp perform(id, {:rank, target, new_rank}) when is_integer(target) and target != id and new_rank in ["officer", "member"] do
    {_, guild} = get_guild(id)
    require_leader(id, guild)
    member = target_member(target, guild)
    ids = affected(guild.id)
    Repo.update!(Ecto.Changeset.change(member, rank: new_rank))
    if new_rank == "member", do: revoke_invites(guild.id, target)
    ids
  end

  defp perform(id, {:transfer, target}) when is_integer(target) and target != id do
    {member, guild} = get_guild(id)
    require_leader(id, guild)
    successor = target_member(target, guild)
    Repo.update!(Ecto.Changeset.change(member, rank: "officer"))
    Repo.update!(Ecto.Changeset.change(successor, rank: "member"))
    Repo.update!(Ecto.Changeset.change(guild, leader_id: target))
    affected(guild.id)
  end

  defp perform(_, _), do: fail("invalid_action")

  defp target_member(id, guild) do
    case membership(id) do
      %{guild_id: guild_id} = member when guild_id == guild.id -> member
      _ -> fail("not_a_member")
    end
  end

  defp revoke_invites(guild_id, inviter_id) do
    Repo.delete_all(from i in Invitation, where: i.guild_id == ^guild_id and i.inviter_id == ^inviter_id)
  end
end

defmodule SunracerWeb.AtlasPilots do
  @moduledoc """
  Compact strategic pilot markers. Never publish another pilot's full
  navigation snapshot, mission, destination or local tactical coordinates.
  Party/guild visibility is server-authorized; neutral visibility is limited
  to the existing 5,000-unit local replication proximity policy.
  """
  alias Core.Universe.Navigation
  alias Core.World.SessionManager
  alias Sunracer.{Accounts, Guilds, World}
  alias SunracerWeb.{PartyManager, WorldStreamPolicy}

  def snapshot(id, session_id) do
    with {:ok, %{player_id: ^id, map_id: map_id}} <- SessionManager.fetch(SessionManager, session_id),
         {:ok, map} <- World.snapshot(map_id) do
      party = PartyManager.member_ids(id)
      guild = case Guilds.chat_audience(id) do
        {:ok, _, rows} -> Enum.map(rows, & &1.pilot_id)
        _ -> []
      end
      nearby = nearby_ids(map, id)
      ignored = Accounts.chat_ignored_ids(id)
      ids = (party ++ guild ++ nearby) |> Enum.uniq() |> Enum.reject(&(&1 == id or &1 in ignored))
      active = Enum.filter(ids, fn pilot ->
        match?({:ok, _}, SessionManager.fetch_player(SessionManager, pilot))
      end)
      positions = Navigation.pilot_positions(Module.concat(SessionManager, Navigation), active)
      accounts = Accounts.get_player_accounts(Map.keys(positions))
      pilots = for account <- accounts,
        position = Map.get(positions, account.id),
        position != nil do
        Map.merge(position, %{pilot_id: account.id, pilot_name: account.pilot_name,
          relation: relation(account.id, party, guild)})
      end
      {:ok, pilots}
    else
      _ -> {:error, "session_not_found"}
    end
  end

  def nearby_ids(%{entities: entities}, id) do
    own = Enum.find(entities, &(Map.get(&1, :player_id) == id and &1.kind == :player))
    if own && is_map(Map.get(own, :position_3d)) do
      for entity <- entities,
        entity.kind == :player,
        is_integer(Map.get(entity, :player_id)),
        entity.player_id != id,
        Map.get(entity, :status) != :destroyed,
        is_map(Map.get(entity, :position_3d)),
        WorldStreamPolicy.visible?(entity, id),
        WorldStreamPolicy.near?(own, entity),
        do: entity.player_id
    else
      []
    end
  end

  def relation(id, party, guild) do
    cond do
      id in party -> "party"
      id in guild -> "guild"
      true -> "neutral"
    end
  end
end

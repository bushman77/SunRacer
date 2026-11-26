defmodule SunracerWeb.StationPilots do
  @moduledoc """
  Shared Green Starbase presentation across private flight maps. Queries
  only active sessions and MapServer-verified parked poses; no private
  combat state or client-supplied identity/position is accepted.
  """
  alias Core.World.{MapServer, SessionManager}
  alias Sunracer.Accounts

  def snapshot(id, session_id, names \\ %{}) do
    with {:ok, %{player_id: ^id} = own} <- SessionManager.fetch(SessionManager, session_id),
         {:ok, _} <- pose(own) do
      rows =
        SessionManager.active_sessions(SessionManager)
        |> Enum.filter(fn session ->
          is_integer(session.player_id) and session.player_id != id and
            session.map_id == "sol:free_#{session.player_id}"
        end)
        |> Enum.flat_map(fn session ->
          case pose(session) do
            {:ok, position} -> [Map.put(position, :player_id, session.player_id)]
            _ -> []
          end
        end)
        |> Enum.sort_by(& &1.player_id)

      ids = Enum.map(rows, & &1.player_id)
      names = Map.take(names, ids)
      missing = Enum.reject(ids, &Map.has_key?(names, &1))
      names = if missing == [], do: names,
        else: Map.merge(names, Map.new(Accounts.get_player_accounts(missing), &{&1.id, &1.pilot_name}))
      avatars = for row <- rows, name = Map.get(names, row.player_id), is_binary(name),
        do: Map.put(row, :pilot_name, name)
      {:ok, avatars, names}
    else
      _ -> {:error, "not_docked"}
    end
  end

  defp pose(%{map_id: map_id, player_id: id, id: session_id, entity_id: entity_id})
       when is_integer(id) do
    if map_id == "sol:free_#{id}" do
      # A private map can terminate between session enumeration and the read.
      try do
        MapServer.station_pose(Core.World.Registry, map_id, session_id, entity_id)
      catch
        :exit, _ -> {:error, :map_unavailable}
      end
    else
      {:error, :not_docked}
    end
  end
  defp pose(_), do: {:error, :not_docked}
end

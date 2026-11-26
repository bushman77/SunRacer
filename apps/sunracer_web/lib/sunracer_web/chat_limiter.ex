defmodule SunracerWeb.ChatLimiter do
  @moduledoc "Per-pilot global chat flood protection across channel rejoins on this node."
  use GenServer

  @window_ms 10_000
  @limit 4

  def start_link(_opts), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  def allow?(pilot_id), do: GenServer.call(__MODULE__, {:allow, pilot_id})

  @impl true
  def init(state) do
    Process.send_after(self(), :prune, @window_ms)
    {:ok, state}
  end

  @impl true
  def handle_call({:allow, id}, _from, state) do
    now = System.monotonic_time(:millisecond)
    recent = Enum.filter(Map.get(state, id, []), &(&1 > now - @window_ms))

    if length(recent) < @limit do
      {:reply, true, Map.put(state, id, [now | recent])}
    else
      {:reply, false, state}
    end
  end

  @impl true
  def handle_info(:prune, state) do
    now = System.monotonic_time(:millisecond)
    state = Map.reject(state, fn {_id, times} ->
      Enum.all?(times, &(&1 <= now - @window_ms))
    end)
    Process.send_after(self(), :prune, @window_ms)
    {:noreply, state}
  end
end

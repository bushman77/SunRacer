defmodule SunracerWeb.PartyManagerTest do
  use ExUnit.Case, async: false
  alias SunracerWeb.PartyManager

  setup do
    server = __MODULE__
    start_supervised!({PartyManager, name: server})
    %{server: server}
  end

  defp pilot(server, id) do
    owner = self()
    pid = spawn(fn ->
      {:ok, _} = PartyManager.register(id, "Pilot #{id}", server)
      send(owner, {:ready, id})
      loop(owner, server, id)
    end)
    assert_receive {:ready, ^id}
    on_exit(fn -> if Process.alive?(pid), do: Process.exit(pid, :kill) end)
    pid
  end

  defp loop(owner, server, id) do
    receive do
      {:action, ref, action} -> send(owner, {ref, PartyManager.action(action, server)})
      {:party_message, message} -> send(owner, {:delivered, id, message})
      {:party_state, _} -> :ok
    end
    loop(owner, server, id)
  end

  defp call(pid, action) do
    ref = make_ref()
    send(pid, {:action, ref, action})
    assert_receive {^ref, reply}
    reply
  end

  test "only invited pilot can accept and only current members receive messages", %{server: server} do
    a = pilot(server, 1)
    b = pilot(server, 2)
    c = pilot(server, 3)
    assert :ok = call(a, {:invite, 2})
    assert {:ok, %{invitation: %{id: token}}} = call(b, :snapshot)
    assert {:error, "invitation_unavailable"} = call(c, {:accept, token})
    assert :ok = call(b, {:accept, token})
    assert {:error, "leader_required"} = call(b, {:remove, 1})
    assert :ok = call(a, {:message, "private"})
    assert_receive {:delivered, 1, %{pilot_id: 1, text: "private"}}
    assert_receive {:delivered, 2, %{pilot_id: 1, text: "private"}}
    refute_receive {:delivered, 3, _}
    assert :ok = call(a, {:remove, 2})
    assert {:error, "not_in_party"} = call(b, {:message, "denied"})
    assert :ok = call(a, {:message, "after removal"})
    assert_receive {:delivered, 1, %{text: "after removal"}}
    refute_receive {:delivered, 2, _}
  end

  test "six-seat capacity, decline and transfer", %{server: server} do
    [a, b, c, d, e, f, g] = Enum.map(1..7, &pilot(server, &1))
    assert :ok = call(a, {:invite, 2})
    assert {:ok, %{invitation: %{id: token}}} = call(b, :snapshot)
    assert :ok = call(b, {:decline, token})
    for {id, pid} <- Enum.zip(2..6, [b,c,d,e,f]) do
      assert :ok = call(a, {:invite, id})
      assert {:ok, %{invitation: %{id: token}}} = call(pid, :snapshot)
      assert :ok = call(pid, {:accept, token})
    end
    assert {:error, "party_full"} = call(a, {:invite, 7})
    assert {:ok, %{party: nil}} = call(g, :snapshot)
    assert :ok = call(a, {:transfer, 2})
    assert {:error, "leader_required"} = call(a, {:remove, 3})
    assert :ok = call(b, :leave)
    assert {:ok, %{party: %{leader_id: 1, members: members}}} = call(a, :snapshot)
    assert length(members) == 5
  end

  test "reconnecting same pilot retains membership", %{server: server} do
    a = pilot(server, 1)
    b = pilot(server, 2)
    assert :ok = call(a, {:invite, 2})
    assert {:ok, %{invitation: %{id: token}}} = call(b, :snapshot)
    assert :ok = call(b, {:accept, token})
    replacement = pilot(server, 2)
    assert {:ok, %{party: %{leader_id: 1, members: members}}} = call(replacement, :snapshot)
    assert length(members) == 2
  end
end

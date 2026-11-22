defmodule Sunracer.Inventory.ViewTest do
  use Sunracer.DataCase, async: false

  import Sunracer.AccountsFixtures

  alias Sunracer.{Inventory, Repo}
  alias Sunracer.Accounts.PlayerAccount
  alias Sunracer.Inventory.View

  test "one pilot's hold, credits, owned items and both installed configurations" do
    pilot = player_account_fixture()
    other = player_account_fixture()
    assert {:ok, empty} = View.snapshot(pilot.id, 1)
    assert empty.ship.name == "Sunracer"
    assert empty.credits == pilot.credits
    assert empty.cargo.items == []
    assert empty.cargo.used_tonnes == 0
    assert empty.cargo.capacity_tonnes == 4
    assert Enum.map(empty.configurations, & &1.number) == [1, 2]
    assert Enum.find(empty.configurations, & &1.active).number == 1

    assert {:ok, _} = Inventory.add_cargo(pilot.id, "medical_supplies", 3)
    assert {:ok, _} = Inventory.add_equipment(pilot.id, "beryl", 2)
    assert {:ok, _} = Inventory.add_cargo(other.id, "titanium", 1)
    assert {:ok, _} = Inventory.add_equipment(other.id, "lf4", 1)
    account = Repo.get!(PlayerAccount, pilot.id)
    assert {:ok, _} = account
      |> Ecto.Changeset.change(credits: 71_000)
      |> Repo.update()

    assert {:ok, view} = View.snapshot(pilot.id, 2)
    assert view.credits == 71_000
    assert view.cargo.used_tonnes == 3
    assert view.cargo.capacity_tonnes == 4
    assert [%{id: "medical_supplies", name: "Medical supplies",
              quantity: 3, total_tonnes: 3}] = view.cargo.items
    refute Enum.any?(view.cargo.items, &(&1.id == "titanium"))
    assert Enum.any?(view.equipment, &(&1.id == "beryl" and &1.quantity == 2))
    refute Enum.any?(view.equipment, &(&1.id == "lf4"))
    assert Enum.find(view.configurations, & &1.active).number == 2
    assert Enum.any?(view.catalog, &(&1.id == "beryl" and is_binary(&1.name)))
    assert %{credits: 71_000} = Repo.get!(PlayerAccount, pilot.id)
    assert Inventory.equipment_count(pilot.id, "beryl") == 2
    assert Map.get(Inventory.cargo_manifest(pilot.id), "medical_supplies") == 3
  end

  test "invalid read requests cannot impersonate another player" do
    assert {:error, :invalid_inventory_request} = View.snapshot(-1, 1)
    assert {:error, :invalid_inventory_request} = View.snapshot(100, 3)
    assert {:error, :invalid_inventory_request} = View.snapshot("100", 1)
  end
end

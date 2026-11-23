defmodule Sunracer.TradeTest do
  use Sunracer.DataCase, async: false

  import Sunracer.AccountsFixtures

  alias Sunracer.{Accounts, Inventory, Repo, Trade}
  alias Sunracer.Trade.Market

  defp fund(pilot, credits) do
    {:ok, account} =
      pilot.id
      |> Accounts.get_player_account!()
      |> Ecto.Changeset.change(credits: credits)
      |> Repo.update()

    account
  end

  defp credits(pilot), do: Accounts.get_player_account!(pilot.id).credits

  describe "price book" do
    test "prices every catalog cargo, tight against the outfitter's price curve" do
      listing = Market.listing()
      assert Enum.map(listing, & &1.id) |> Enum.sort() ==
               Sunracer.Cargo.Catalog.all() |> Map.keys() |> Enum.sort()

      assert {:ok, 75} = Market.sell_price("methane")
      assert {:ok, 200} = Market.sell_price("titanium")
      assert {:ok, 450} = Market.sell_price("dilithium")
      assert {:error, :unknown_cargo} = Market.sell_price("gold_bars")
      assert {:error, :unknown_cargo} = Market.sell_price(nil)

      # A full starter hold (4 t) of the best cargo is far below the
      # cheapest 20,000-credit fitting.
      best = listing |> Enum.map(& &1.sell_price) |> Enum.max()
      assert best * 4 * 10 < Sunracer.Outfitting.Shop.stock() |>
               Enum.map(& &1.price) |> Enum.min()
    end

    test "stocked goods always cost more to buy than they sell for" do
      for good <- Market.listing(), good.buy_price do
        assert good.buy_price > good.sell_price, good.id
      end

      assert {:ok, 98} = Market.buy_price("methane")
      assert {:ok, 585} = Market.buy_price("dilithium")
      assert {:error, :not_stocked} = Market.buy_price("civilian_mail")
      assert {:error, :not_stocked} = Market.buy_price("research_data")
      assert {:error, :unknown_cargo} = Market.buy_price("gold_bars")
    end
  end

  describe "selling" do
    test "sells held cargo for credits, atomically" do
      pilot = player_account_fixture()
      start = fund(pilot, 1_000).credits
      assert {:ok, _} = Inventory.add_cargo(pilot.id, "dilithium", 3)

      assert {:ok, %{receipt: receipt, exchange: view}} =
               Trade.sell(pilot.id, "dilithium", 2)

      assert receipt.action == "sold"
      assert receipt.unit_price == 450
      assert receipt.total == 900
      assert receipt.credits_remaining == start + 900
      assert view.credits == start + 900
      assert Enum.find(view.goods, &(&1.id == "dilithium")).quantity == 1
      assert credits(pilot) == start + 900
      assert Inventory.cargo_manifest(pilot.id) == %{"dilithium" => 1}
    end

    test "cannot sell more than is aboard; nothing changes" do
      pilot = player_account_fixture()
      start = fund(pilot, 500).credits
      assert {:ok, _} = Inventory.add_cargo(pilot.id, "civilian_mail", 1)

      assert {:error, :not_enough_cargo} = Trade.sell(pilot.id, "civilian_mail", 2)
      assert {:error, :not_enough_cargo} = Trade.sell(pilot.id, "titanium", 1)
      assert credits(pilot) == start
      assert Inventory.cargo_manifest(pilot.id) == %{"civilian_mail" => 1}
    end

    test "loot-only cargo can be sold even though it is never stocked" do
      pilot = player_account_fixture()
      start = fund(pilot, 0).credits
      assert {:ok, _} = Inventory.add_cargo(pilot.id, "research_data", 1)
      assert {:ok, %{receipt: %{total: 450}}} = Trade.sell(pilot.id, "research_data", 1)
      assert credits(pilot) == start + 450
      assert Inventory.cargo_manifest(pilot.id) == %{}
    end
  end

  describe "buying" do
    test "buys stocked cargo into free hold space" do
      pilot = player_account_fixture()
      fund(pilot, 1_000)

      assert {:ok, %{receipt: receipt, exchange: view}} =
               Trade.buy(pilot.id, "titanium", 2)

      assert receipt.action == "bought"
      assert receipt.unit_price == 260
      assert receipt.total == 520
      assert receipt.credits_remaining == 480
      assert view.hold.used == 2
      assert credits(pilot) == 480
      assert Inventory.cargo_manifest(pilot.id) == %{"titanium" => 2}
    end

    test "needs enough credits and hold space; nothing changes on refusal" do
      pilot = player_account_fixture()
      fund(pilot, 500)

      assert {:error, :insufficient_credits} = Trade.buy(pilot.id, "dilithium", 1)
      assert credits(pilot) == 500
      assert Inventory.cargo_manifest(pilot.id) == %{}

      fund(pilot, 100_000)
      # The starter Sunracer holds 4 t.
      assert {:error, :cargo_hold_full} = Trade.buy(pilot.id, "methane", 5)
      assert credits(pilot) == 100_000
      assert Inventory.cargo_manifest(pilot.id) == %{}

      assert {:error, :not_stocked} = Trade.buy(pilot.id, "civilian_mail", 1)
      assert credits(pilot) == 100_000
    end

    test "buying and selling back at the same desk always loses credits" do
      pilot = player_account_fixture()
      fund(pilot, 10_000)

      for good <- Market.listing(), good.buy_price do
        before = credits(pilot)
        assert {:ok, _} = Trade.buy(pilot.id, good.id, 1)
        assert {:ok, _} = Trade.sell(pilot.id, good.id, 1)
        assert credits(pilot) < before, good.id
      end
    end
  end

  test "rejects malformed requests before touching the database" do
    pilot = player_account_fixture()
    start = fund(pilot, 5_000).credits

    for amount <- [0, -1, 1_001, "2", 1.5, nil] do
      assert {:error, :invalid_amount} = Trade.sell(pilot.id, "methane", amount)
      assert {:error, :invalid_amount} = Trade.buy(pilot.id, "methane", amount)
    end

    assert {:error, :unknown_cargo} = Trade.buy(pilot.id, "gold_bars", 1)
    assert {:error, :unknown_cargo} = Trade.sell(pilot.id, nil, 1)
    assert credits(pilot) == start
  end

  test "snapshot shows held cargo and stocked goods only" do
    pilot = player_account_fixture()
    fund(pilot, 2_000)
    assert {:ok, _} = Inventory.add_cargo(pilot.id, "civilian_mail", 1)

    assert {:ok, view} = Trade.snapshot(pilot.id)
    assert view.credits == 2_000
    assert view.hold == %{capacity: 4, used: 1}
    ids = Enum.map(view.goods, & &1.id)
    assert "civilian_mail" in ids
    assert "methane" in ids
    refute "research_data" in ids
    assert Enum.find(view.goods, &(&1.id == "civilian_mail")).buy_price == nil
  end
end

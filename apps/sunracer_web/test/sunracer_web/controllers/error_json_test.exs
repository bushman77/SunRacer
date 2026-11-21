defmodule SunracerWeb.ErrorJSONTest do
  use SunracerWeb.ConnCase, async: true

  test "renders 404" do
    assert SunracerWeb.ErrorJSON.render("404.json", %{}) == %{errors: %{detail: "Not Found"}}
  end

  test "renders 500" do
    assert SunracerWeb.ErrorJSON.render("500.json", %{}) ==
             %{errors: %{detail: "Internal Server Error"}}
  end
end

import pytest

from app.services.nearby import (
    NEARBY_MAX_KM,
    Candidate,
    Place,
    extremes,
    nearest,
)

NASHIK = Place("nashik", 20.0, 73.79)
# Straight lines from Nashik: Ahmednagar 142 km, Pune 165, Jalgaon 215, Solapur 343.
AHMEDNAGAR = Place("ahmednagar", 19.09, 74.74)
PUNE = Place("pune", 18.52, 73.86)
JALGAON = Place("jalgaon", 21.0, 75.56)
SOLAPUR = Place("solapur", 17.66, 75.91)


def test_the_rule_is_every_area_within_150_km() -> None:
    assert NEARBY_MAX_KM == 150


def test_nearest_areas_come_nearest_first_without_the_area_itself() -> None:
    found = nearest(NASHIK, [SOLAPUR, PUNE, NASHIK, JALGAON, AHMEDNAGAR], max_km=300)
    assert found == [("ahmednagar", 142), ("pune", 165), ("jalgaon", 215)]


def test_every_area_within_the_distance_counts_however_many() -> None:
    # Five areas around Nashik, all within 150 km: no cap on the number.
    close = [Place(f"p{i}", 20.0 + i * 0.1, 73.79) for i in range(1, 6)]
    assert [area for area, _ in nearest(NASHIK, close)] == ["p1", "p2", "p3", "p4", "p5"]


def test_nearest_areas_stop_at_the_distance() -> None:
    assert nearest(NASHIK, [SOLAPUR, PUNE, JALGAON], max_km=200) == [("pune", 165)]
    # Ahmednagar (142 km) is inside the radius, Pune (165) and Solapur (343) are not.
    assert nearest(NASHIK, [SOLAPUR, PUNE, AHMEDNAGAR]) == [("ahmednagar", 142)]


def test_the_distance_limit_is_inclusive() -> None:
    assert nearest(NASHIK, [PUNE], max_km=165) == [("pune", 165)]
    assert nearest(NASHIK, [PUNE], max_km=164) == []


def test_equal_distances_keep_the_given_order() -> None:
    twin_a = Place("a", 20.0, 74.0)
    twin_b = Place("b", 20.0, 73.58)  # the same distance on the other side
    assert nearest(NASHIK, [twin_b, twin_a]) == [("b", 22), ("a", 22)]


Row = tuple[str, float, float, int, bool]


def _pick(base_price: float, *neighbours: tuple[str, float, int]) -> tuple[Row, Row]:
    found = extremes("here", base_price, [Candidate(a, p, km) for a, p, km in neighbours])
    assert found is not None
    high, low = found.highest, found.lowest
    return (
        (high.area_id, high.price, high.diff, high.distance_km, high.is_base),
        (low.area_id, low.price, low.diff, low.distance_km, low.is_base),
    )


def test_highest_and_lowest_neighbour_with_their_difference() -> None:
    high, low = _pick(24.0, ("pune", 25.2, 165), ("ahmednagar", 23.1, 142), ("jalgaon", 24.5, 215))
    assert high == ("pune", 25.2, pytest.approx(1.2), 165, False)
    assert low == ("ahmednagar", 23.1, pytest.approx(-0.9), 142, False)


def test_the_viewed_area_itself_can_be_the_highest_or_the_lowest() -> None:
    high, low = _pick(26.0, ("agra", 24.0, 191))
    assert high == ("here", 26.0, 0.0, 0, True)
    assert low == ("agra", 24.0, pytest.approx(-2.0), 191, False)
    high, low = _pick(22.0, ("agra", 24.0, 191))
    assert high == ("agra", 24.0, pytest.approx(2.0), 191, False)
    assert low == ("here", 22.0, 0.0, 0, True)


def test_a_tie_with_the_viewed_area_goes_to_it() -> None:
    # Nobody nearby pays more than here, so here is the highest.
    high, low = _pick(24.0, ("pune", 24.0, 165), ("ahmednagar", 23.0, 142))
    assert high == ("here", 24.0, 0.0, 0, True)
    assert low[0] == "ahmednagar"


def test_a_tie_between_neighbours_goes_to_the_nearer_one() -> None:
    high, low = _pick(24.0, ("far", 25.0, 200), ("near", 25.0, 50), ("low", 23.0, 90))
    assert high[0] == "near"
    high, low = _pick(24.0, ("far", 23.0, 200), ("near", 23.0, 50), ("high", 25.0, 90))
    assert low[0] == "near"


def test_float_noise_below_the_stored_precision_is_a_tie() -> None:
    high, _ = _pick(0.3, ("noise", 0.1 + 0.2, 10), ("low", 0.2, 20))
    assert high[0] == "here"


def test_nothing_to_show_without_neighbours_or_when_every_price_is_the_same() -> None:
    assert extremes("here", 24.0, []) is None
    assert extremes("here", 24.0, [Candidate("a", 24.0, 10), Candidate("b", 24.0, 20)]) is None

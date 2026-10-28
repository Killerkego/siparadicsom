"""A végpontok kéréseinek formája."""

from typing import Annotated

from pydantic import BaseModel, StringConstraints

PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]


class PlayerIn(BaseModel):
    name: PlayerName


class CreateIn(PlayerIn):
    public: bool = False  # nyilvános lobbi: a lobbik oldalán listázzuk; privátba csak a kóddal lehet belépni


class PlayerRef(BaseModel):
    player_id: str


class ChoiceIn(BaseModel):
    player_id: str
    choice: str


class VisibilityIn(BaseModel):
    player_id: str
    public: bool


class FigureIn(BaseModel):
    player_id: str
    figure: int


class DevMoveIn(BaseModel):
    player_id: str
    field: int

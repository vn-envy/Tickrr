"""Static player -> national-team map for the WC Golden Boot field.

Used to roll player goal-scorer markets up into team-level "attacking threat" signals. A
Gemini call could generate this, but a static table is reliable and key-free; extend as the
field firms up. Unmapped players simply don't contribute (graceful).
"""
from __future__ import annotations

_PLAYER_COUNTRY = {
    "Lionel Messi": "Argentina", "Lautaro Martinez": "Argentina", "Julian Alvarez": "Argentina",
    "Kylian Mbappe": "France", "Ousmane Dembele": "France", "Bradley Barcola": "France",
    "Michael Olise": "France", "Antoine Griezmann": "France", "Kingsley Coman": "France",
    "Cristiano Ronaldo": "Portugal", "Rafael Leao": "Portugal", "Bruno Fernandes": "Portugal",
    "Goncalo Ramos": "Portugal",
    "Bukayo Saka": "England", "Harry Kane": "England", "Jude Bellingham": "England",
    "Phil Foden": "England", "Cole Palmer": "England", "Marcus Rashford": "England",
    "Cody Gakpo": "Netherlands", "Memphis Depay": "Netherlands",
    "Federico Valverde": "Uruguay", "Darwin Nunez": "Uruguay",
    "Romelu Lukaku": "Belgium", "Kevin De Bruyne": "Belgium",
    "Igor Thiago": "Brazil", "Vinicius Junior": "Brazil", "Rodrygo": "Brazil",
    "Raphinha": "Brazil", "Neymar": "Brazil",
    "Erling Haaland": "Norway",
    "Lamine Yamal": "Spain", "Nico Williams": "Spain", "Alvaro Morata": "Spain", "Pedri": "Spain",
    "Jamal Musiala": "Germany", "Florian Wirtz": "Germany", "Kai Havertz": "Germany",
    "Mohamed Salah": "Egypt", "Victor Osimhen": "Nigeria",
    "Khvicha Kvaratskhelia": "Georgia", "Dusan Vlahovic": "Serbia",
    "Ruben Vargas": "Switzerland", "Marko Arnautovic": "Austria",
}


def _norm(s: str | None) -> str:
    return "".join(ch for ch in (s or "").lower() if ch.isalnum())


_INDEX = {_norm(k): v for k, v in _PLAYER_COUNTRY.items()}


def country_for(player: str | None) -> str | None:
    return _INDEX.get(_norm(player))

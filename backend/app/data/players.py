"""Player -> national-team map for the WC Golden Boot field.

Rolls player goal-scorer markets up into team-level "attacking threat" signals and powers the
player dossier. A Gemini call could auto-resolve unknowns, but a static table is reliable and
key-free; unmapped players simply don't contribute (graceful). Names are matched accent- and
punctuation-insensitively, so "Suarez" matches "Suárez" and "Mbappe" matches "Mbappé".
"""
from __future__ import annotations

import unicodedata

_PLAYER_COUNTRY = {
    # Argentina
    "Lionel Messi": "Argentina", "Lautaro Martinez": "Argentina", "Julian Alvarez": "Argentina",
    # France
    "Kylian Mbappe": "France", "Ousmane Dembele": "France", "Bradley Barcola": "France",
    "Michael Olise": "France", "Antoine Griezmann": "France", "Kingsley Coman": "France",
    "Desire Doue": "France",
    # Portugal
    "Cristiano Ronaldo": "Portugal", "Rafael Leao": "Portugal", "Bruno Fernandes": "Portugal",
    "Goncalo Ramos": "Portugal",
    # England
    "Bukayo Saka": "England", "Harry Kane": "England", "Jude Bellingham": "England",
    "Phil Foden": "England", "Cole Palmer": "England", "Marcus Rashford": "England",
    # Spain
    "Lamine Yamal": "Spain", "Nico Williams": "Spain", "Alvaro Morata": "Spain", "Pedri": "Spain",
    "Mikel Oyarzabal": "Spain", "Ferran Torres": "Spain", "Dani Olmo": "Spain",
    # Netherlands
    "Cody Gakpo": "Netherlands", "Memphis Depay": "Netherlands", "Depay Memphis": "Netherlands",
    "Donyell Malen": "Netherlands",
    # Brazil
    "Igor Thiago": "Brazil", "Vinicius Junior": "Brazil", "Rodrygo": "Brazil",
    "Raphinha": "Brazil", "Neymar": "Brazil", "Endrick": "Brazil",
    # Germany
    "Jamal Musiala": "Germany", "Florian Wirtz": "Germany", "Kai Havertz": "Germany",
    "Deniz Undav": "Germany",
    # Others
    "Federico Valverde": "Uruguay", "Darwin Nunez": "Uruguay",
    "Romelu Lukaku": "Belgium", "Kevin De Bruyne": "Belgium",
    "Erling Haaland": "Norway",
    "Mohamed Salah": "Egypt",
    "Victor Osimhen": "Nigeria",
    "Khvicha Kvaratskhelia": "Georgia",
    "Dusan Vlahovic": "Serbia",
    "Ruben Vargas": "Switzerland",
    "Marko Arnautovic": "Austria",
    "Viktor Gyokeres": "Sweden",
    "Luis Javier Suarez": "Colombia", "Luis Diaz": "Colombia",
    "Amad Diallo": "Ivory Coast",
    "Antoine Semenyo": "Ghana",
}


def _norm(s: str | None) -> str:
    """Lowercase, strip diacritics + punctuation, so accented names match an ASCII table."""
    decomposed = unicodedata.normalize("NFKD", s or "")
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return "".join(ch for ch in no_accents.lower() if ch.isalnum())


_INDEX = {_norm(k): v for k, v in _PLAYER_COUNTRY.items()}


def country_for(player: str | None) -> str | None:
    return _INDEX.get(_norm(player))

export interface OpeningInfo {
  eco: string;
  name: string;
}

interface OpeningEntry extends OpeningInfo {
  line: readonly string[];
}

const OPENINGS: readonly OpeningEntry[] = [
  // King's Pawn (1. e4 e5)
  { eco: "C20", name: "King's Pawn Opening", line: ["e4", "e5"] },
  { eco: "C23", name: "Bishop's Opening", line: ["e4", "e5", "Bc4"] },
  { eco: "C25", name: "Vienna Game", line: ["e4", "e5", "Nc3"] },
  { eco: "C30", name: "King's Gambit", line: ["e4", "e5", "f4"] },
  { eco: "C41", name: "Philidor Defense", line: ["e4", "e5", "Nf3", "d6"] },
  { eco: "C42", name: "Petrov's Defense", line: ["e4", "e5", "Nf3", "Nf6"] },
  { eco: "C44", name: "Scotch Game", line: ["e4", "e5", "Nf3", "Nc6", "d4"] },
  { eco: "C47", name: "Four Knights Game", line: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"] },
  { eco: "C50", name: "Italian Game", line: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { eco: "C53", name: "Italian Game: Giuoco Piano", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { eco: "C55", name: "Italian Game: Two Knights", line: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"] },
  { eco: "C60", name: "Ruy Lopez", line: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"] },
  { eco: "C70", name: "Ruy Lopez: Morphy Defense", line: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"] },

  // Semi-open 1. e4 defenses
  { eco: "B20", name: "Sicilian Defense", line: ["e4", "c5"] },
  { eco: "B22", name: "Sicilian: Alapin Variation", line: ["e4", "c5", "c3"] },
  { eco: "B23", name: "Sicilian: Closed", line: ["e4", "c5", "Nc3"] },
  { eco: "B27", name: "Sicilian: Open", line: ["e4", "c5", "Nf3"] },
  {
    eco: "B34",
    name: "Sicilian: Accelerated Dragon",
    line: ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6"],
  },
  {
    eco: "B44",
    name: "Sicilian: Taimanov",
    line: ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "Nc6"],
  },
  {
    eco: "B70",
    name: "Sicilian: Dragon",
    line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"],
  },
  {
    eco: "B80",
    name: "Sicilian: Scheveningen",
    line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"],
  },
  {
    eco: "B90",
    name: "Sicilian: Najdorf",
    line: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  },
  { eco: "C00", name: "French Defense", line: ["e4", "e6"] },
  { eco: "C02", name: "French: Advance Variation", line: ["e4", "e6", "d4", "d5", "e5"] },
  { eco: "C03", name: "French: Tarrasch Variation", line: ["e4", "e6", "d4", "d5", "Nd2"] },
  { eco: "C11", name: "French: Classical", line: ["e4", "e6", "d4", "d5", "Nc3", "Nf6"] },
  { eco: "C15", name: "French: Winawer", line: ["e4", "e6", "d4", "d5", "Nc3", "Bb4"] },
  { eco: "B10", name: "Caro-Kann Defense", line: ["e4", "c6"] },
  { eco: "B12", name: "Caro-Kann: Advance Variation", line: ["e4", "c6", "d4", "d5", "e5"] },
  { eco: "B13", name: "Caro-Kann: Exchange", line: ["e4", "c6", "d4", "d5", "exd5", "cxd5"] },
  {
    eco: "B18",
    name: "Caro-Kann: Classical",
    line: ["e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5"],
  },
  { eco: "B01", name: "Scandinavian Defense", line: ["e4", "d5"] },
  { eco: "B02", name: "Alekhine's Defense", line: ["e4", "Nf6"] },
  { eco: "B06", name: "Modern Defense", line: ["e4", "g6"] },
  { eco: "B07", name: "Pirc Defense", line: ["e4", "d6", "d4", "Nf6", "Nc3"] },

  // Queen's Pawn & Indian Systems
  { eco: "D00", name: "Queen's Pawn Game", line: ["d4", "d5"] },
  { eco: "D02", name: "London System", line: ["d4", "d5", "Nf3", "Nf6", "Bf4"] },
  { eco: "D02", name: "London System", line: ["d4", "Nf6", "Bf4"] },
  { eco: "A45", name: "Trompowsky Attack", line: ["d4", "Nf6", "Bg5"] },
  { eco: "D06", name: "Queen's Gambit", line: ["d4", "d5", "c4"] },
  { eco: "D07", name: "Queen's Gambit: Chigorin", line: ["d4", "d5", "c4", "Nc6"] },
  { eco: "D10", name: "Slav Defense", line: ["d4", "d5", "c4", "c6"] },
  { eco: "D20", name: "Queen's Gambit Accepted", line: ["d4", "d5", "c4", "dxc4"] },
  { eco: "D30", name: "Queen's Gambit Declined", line: ["d4", "d5", "c4", "e6"] },
  { eco: "D37", name: "Queen's Gambit Declined: Classical", line: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"] },
  { eco: "E00", name: "Catalan Opening", line: ["d4", "Nf6", "c4", "e6", "g3"] },
  { eco: "E12", name: "Queen's Indian Defense", line: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"] },
  { eco: "E20", name: "Nimzo-Indian Defense", line: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { eco: "E60", name: "King's Indian Defense", line: ["d4", "Nf6", "c4", "g6"] },
  { eco: "D80", name: "Grunfeld Defense", line: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"] },
  { eco: "A60", name: "Benoni Defense", line: ["d4", "Nf6", "c4", "c5", "d5"] },
  { eco: "A80", name: "Dutch Defense", line: ["d4", "f5"] },

  // Flank Openings
  { eco: "A10", name: "English Opening", line: ["c4"] },
  { eco: "A20", name: "English: Reversed Sicilian", line: ["c4", "e5"] },
  { eco: "A30", name: "English: Symmetrical", line: ["c4", "c5"] },
  { eco: "A04", name: "Zukertort Opening", line: ["Nf3"] },
  { eco: "A06", name: "Reti Opening", line: ["Nf3", "d5"] },
  { eco: "A01", name: "Nimzo-Larsen Attack", line: ["b3"] },
  { eco: "A00", name: "Bird's Opening", line: ["f4"] },
  { eco: "A00", name: "Polish Opening", line: ["b4"] },
  { eco: "A00", name: "King's Fianchetto Opening", line: ["g3"] },
];

function cleanSan(san: string): string {
  return san.replace(/[+#!?]+$/g, "");
}

/**
 * Returns the deepest known ECO opening matching the start of `moves`, or null
 * when fewer than 1 recognized opening move has been played.
 */
export function detectOpening(moves: readonly string[]): OpeningInfo | null {
  if (moves.length === 0) return null;
  const cleaned = moves.slice(0, 16).map(cleanSan);
  let best: OpeningEntry | null = null;
  for (const entry of OPENINGS) {
    if (entry.line.length > cleaned.length) continue;
    if (best && entry.line.length <= best.line.length) continue;
    let matches = true;
    for (let i = 0; i < entry.line.length; i += 1) {
      if (cleaned[i] !== entry.line[i]) {
        matches = false;
        break;
      }
    }
    if (matches) best = entry;
  }
  return best ? { eco: best.eco, name: best.name } : null;
}

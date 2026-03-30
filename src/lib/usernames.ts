/**
 * Dune-themed Username Generator
 * Provides randomized display names based on the Dune universe.
 */

const DUNE_TERMS = [
  "Paul", "Chani", "Leto", "Jessica", "Alia", "Stilgar", "Duncan", "Gurney", "Thufir", "Yueh",
  "Vladimir", "Feyd", "Rabban", "Shaddam", "Irulan", "Mohiam", "Pardot", "Liet", "Siona", "Teg",
  "Idaho", "Atreides", "Harkonnen", "Corrino", "Fremen", "Sardaukar", "Bene-Gesserit", 
  "Kwisatz-Haderach", "MuadDib", "Usul", "Shai-Hulud", "Arrakis", "Caladan", "Giedi-Prime", 
  "Dune", "Spacing-Guild", "Mentat", "Gom-Jabbar", "Crysknife", "Kanly", "Lisan-al-Gaib",
  "Mahdi", "Sietch", "Naib", "Bashar", "Burseg", "Caid"
];

const DUNE_ADJECTIVES = [
  "Golden", "Fierce", "Noble", "Cunning", "Wise", "Ancient", "Desert", "Storm", "Sand", "Spice",
  "Shadow", "Silent", "Royal", "Fallen", "Risen", "Hidden", "Everlasting", "Holy", "Prophetic"
];

export function generateDuneUsername(): string {
  const name = DUNE_TERMS[Math.floor(Math.random() * DUNE_TERMS.length)];
  const adj = DUNE_ADJECTIVES[Math.floor(Math.random() * DUNE_ADJECTIVES.length)];
  const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  
  // Mix it up: sometimes [Adj][Name], sometimes [Name][Num]
  if (Math.random() > 0.5) {
    return `${adj}-${name}-${num}`;
  }
  return `${name}-${num}`;
}

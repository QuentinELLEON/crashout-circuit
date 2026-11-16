/** Associe un type de commande à son horodatage réseau. */
export interface BaseMsg {
  type: string;
  t: number; // timestamp ms
}

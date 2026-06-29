"use strict";

const SHIFT_CARD_LIBRARY = {
  server: {
    id: "server", kind: "worker", name: "Section Server", role: "FOH", composure: 60,
    flavour: "Carries six plates and three conversations at once.",
    moves: [
      { name: "Quick Check", cost: 1, damage: 10, text: "Fast, reliable service." },
      { name: "Perfect Upsell", cost: 2, damage: 22, text: "Extra stress if your hand is full." }
    ]
  },
  bartender: {
    id: "bartender", kind: "worker", name: "Cocktail Bartender", role: "BAR", composure: 65,
    flavour: "Knows every spec and exactly who ordered the mojito.",
    moves: [
      { name: "Perfect Pour", cost: 1, damage: 12, text: "Clean and efficient." },
      { name: "Last Orders", cost: 3, damage: 32, text: "Heavy closing-time pressure." }
    ]
  },
  chef: {
    id: "chef", kind: "worker", name: "Senior Chef", role: "BOH", composure: 82,
    flavour: "The pass is hot and the tickets never stop.",
    moves: [
      { name: "Hot Pass", cost: 2, damage: 20, text: "Solid BOH pressure." },
      { name: "Send It", cost: 3, damage: 36, text: "Big damage, no hesitation." }
    ]
  },
  host: {
    id: "host", kind: "worker", name: "Front Door Host", role: "FOH", composure: 55,
    flavour: "Turns a queue into a plan before anyone starts complaining.",
    moves: [
      { name: "Warm Welcome", cost: 1, damage: 9, heal: 4, text: "Deal stress and recover composure." },
      { name: "Table Turn", cost: 2, damage: 24, text: "Keeps the whole floor moving." }
    ]
  },
  runner: {
    id: "runner", kind: "worker", name: "Food Runner", role: "FOH", composure: 52,
    flavour: "Somehow already knows where table forty-two is.",
    moves: [
      { name: "Food Run", cost: 1, damage: 14, text: "Quick pressure from the pass." },
      { name: "Clear & Reset", cost: 2, damage: 18, draw: 1, text: "Attack and draw one card." }
    ]
  },
  kp: {
    id: "kp", kind: "worker", name: "Kitchen Porter", role: "BOH", composure: 76,
    flavour: "The shift survives because the pot wash never stops.",
    moves: [
      { name: "Pot Wash", cost: 1, damage: 8, guard: 5, text: "Gain a small guard." },
      { name: "Deep Clean", cost: 2, damage: 25, text: "Methodical and relentless." }
    ]
  },
  supervisor: {
    id: "supervisor", kind: "worker", name: "Shift Supervisor", role: "LEAD", composure: 70,
    flavour: "Has already fixed the problem you just noticed.",
    moves: [
      { name: "Section Check", cost: 1, damage: 13, text: "Reliable leadership pressure." },
      { name: "Rally the Team", cost: 2, damage: 17, heal: 12, text: "Damage and restore composure." }
    ]
  },
  manager: {
    id: "manager", kind: "worker", name: "Duty Manager", role: "LEAD", composure: 88,
    flavour: "Appears whenever a situation needs calming down immediately.",
    moves: [
      { name: "De-escalate", cost: 1, damage: 8, heal: 10, text: "Reduce stress and recover." },
      { name: "Service Recovery", cost: 3, damage: 30, guard: 8, text: "Resolve the issue and brace." }
    ]
  },
  regular: {
    id: "regular", kind: "customer", name: "The Regular", category: "LOVELY",
    flavour: "Same table, same drink, zero drama.", effect: "heal", value: 18,
    text: "Restore 18 composure to your active worker."
  },
  birthday: {
    id: "birthday", kind: "customer", name: "Birthday Table", category: "PARTY",
    flavour: "Three cakes, twelve cameras and one person hiding balloons.", effect: "draw_shift", value: 2,
    text: "Draw one card and gain 2 Shift Points."
  },
  critic: {
    id: "critic", kind: "customer", name: "Food Critic", category: "PRESSURE",
    flavour: "Quietly taking notes while everyone suddenly remembers the garnish spec.", effect: "stress", value: 16,
    text: "Deal 16 stress to the opposing active worker."
  },
  influencer: {
    id: "influencer", kind: "customer", name: "Local Influencer", category: "SOCIAL",
    flavour: "The food is getting cold, but the lighting is perfect.", effect: "draw", value: 2,
    text: "Draw 2 cards."
  },
  allergy: {
    id: "allergy", kind: "customer", name: "Allergy Guest", category: "CARE",
    flavour: "The table needs absolute accuracy and perfect communication.", effect: "surcharge", value: 1,
    text: "The opponent's next move costs 1 extra Shift Point."
  },
  walkin: {
    id: "walkin", kind: "customer", name: "Last-Minute Walk-In", category: "RUSH",
    flavour: "A table for eight, right now, beside the window if possible.", effect: "drain", value: 2,
    text: "Remove up to 2 Shift Points from the opponent."
  },
  bottomless: {
    id: "bottomless", kind: "customer", name: "Bottomless Brunch Crew", category: "CHAOS",
    flavour: "Every glass is empty at exactly the same time.", effect: "spread", value: 8,
    text: "Deal 8 stress to every opposing worker."
  },
  complaint: {
    id: "complaint", kind: "customer", name: "Complaint Guest", category: "PRESSURE",
    flavour: "Needs the manager, but first needs to explain everything twice.", effect: "silence", value: 1,
    text: "The opponent cannot use their second move next turn."
  },
  lovelycouple: {
    id: "lovelycouple", kind: "customer", name: "Lovely Couple", category: "LOVELY",
    flavour: "Leave a glowing review and make the whole shift feel worthwhile.", effect: "heal_draw", value: 10,
    text: "Heal 10 composure and draw a card."
  },
  largeparty: {
    id: "largeparty", kind: "customer", name: "Large Party", category: "CHAOS",
    flavour: "Fourteen guests, six split bills and three missing chairs.", effect: "both_stress", value: 10,
    text: "Both active workers take 10 stress."
  },
  latearrival: {
    id: "latearrival", kind: "customer", name: "Late Arrival", category: "RUSH",
    flavour: "The kitchen closes in six minutes. They would like three courses.", effect: "shift", value: 2,
    text: "Gain 2 Shift Points."
  },
  noshow: {
    id: "noshow", kind: "customer", name: "No-Show Booking", category: "QUIET",
    flavour: "A table disappears and everyone gets thirty seconds to breathe.", effect: "draw", value: 3,
    text: "Draw 3 cards."
  }
};

const SHIFT_PLAYER_DECK = [
  "server","server","bartender","chef","host","runner","kp","supervisor","manager",
  "regular","birthday","critic","influencer","allergy","walkin","bottomless","complaint","lovelycouple","latearrival","noshow"
];

const SHIFT_AI_DECK = [
  "server","bartender","bartender","chef","chef","host","kp","supervisor","manager",
  "regular","critic","critic","allergy","walkin","bottomless","bottomless","complaint","largeparty","latearrival","noshow"
];

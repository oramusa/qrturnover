// Predefined checklist packs a host can seed into their checklist_templates.
// Each pack covers the same 4 common room types with a different level of detail.

export type StarterTemplatePack = {
  id: string;
  name: string;
  description: string;
  rooms: { roomType: string; items: string[] }[];
};

export const STARTER_TEMPLATE_PACKS: StarterTemplatePack[] = [
  {
    id: "essentials",
    name: "Essentials",
    description: "A light pass between guests — the basics, nothing extra.",
    rooms: [
      {
        roomType: "Kitchen",
        items: ["Countertops wiped", "Sink cleaned", "Trash emptied", "Dishes put away"],
      },
      {
        roomType: "Bathroom",
        items: ["Mirror cleaned", "Toilet cleaned", "Sink cleaned", "Floor swept"],
      },
      {
        roomType: "Bedroom",
        items: ["Bed made", "Floor swept", "Surfaces dusted"],
      },
      {
        roomType: "Living Room",
        items: ["Floor vacuumed", "Surfaces dusted", "Trash emptied"],
      },
    ],
  },
  {
    id: "standard",
    name: "Standard",
    description: "A thorough, well-rounded turnover — the recommended default.",
    rooms: [
      {
        roomType: "Kitchen",
        items: [
          "Countertops wiped",
          "Sink and drain cleaned",
          "Refrigerator wiped down",
          "Stove and oven wiped",
          "Dishes washed and put away",
          "Trash emptied",
          "Floor swept and mopped",
        ],
      },
      {
        roomType: "Bathroom",
        items: [
          "Mirror cleaned",
          "Sink and countertop wiped",
          "Toilet scrubbed",
          "Shower and tub cleaned",
          "Floor mopped",
          "Toiletries restocked",
        ],
      },
      {
        roomType: "Bedroom",
        items: [
          "Bed made with fresh linens",
          "Surfaces dusted",
          "Floor vacuumed",
          "Closet tidied",
          "Trash emptied",
        ],
      },
      {
        roomType: "Living Room",
        items: [
          "Surfaces dusted",
          "Floor vacuumed",
          "Cushions straightened",
          "Trash emptied",
          "Electronics and remotes wiped",
        ],
      },
    ],
  },
  {
    id: "deep-clean",
    name: "Deep Clean",
    description: "For turnovers between longer stays or seasonal resets — covers every detail.",
    rooms: [
      {
        roomType: "Kitchen",
        items: [
          "Countertops sanitized",
          "Sink and drain scrubbed",
          "Refrigerator cleaned inside and out",
          "Stove and oven deep cleaned",
          "Cabinet fronts wiped",
          "Dishes washed and put away",
          "Trash emptied and liner replaced",
          "Floor swept and mopped",
          "Small appliances wiped down",
        ],
      },
      {
        roomType: "Bathroom",
        items: [
          "Mirror polished",
          "Sink and countertop sanitized",
          "Toilet scrubbed inside and out",
          "Shower, tub, and grout scrubbed",
          "Drains cleared",
          "Floor mopped",
          "Vents dusted",
          "Toiletries restocked",
        ],
      },
      {
        roomType: "Bedroom",
        items: [
          "Bed made with fresh linens",
          "All surfaces dusted",
          "Floor vacuumed, including edges",
          "Closet tidied",
          "Under bed checked",
          "Windows and sills wiped",
          "Trash emptied",
        ],
      },
      {
        roomType: "Living Room",
        items: [
          "All surfaces dusted",
          "Floor vacuumed thoroughly",
          "Cushions fluffed and straightened",
          "Windows and sills wiped",
          "Electronics and remotes sanitized",
          "Trash emptied",
        ],
      },
    ],
  },
];

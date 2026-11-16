// ────────────────────────────────────────────────────────
// Catálogo de ancestrais e comunidades DaggerHeart (SRD 2.0).
// ────────────────────────────────────────────────────────

export const DH_ANCESTRIES = [
  { key: 'aetheris',  name_pt: 'Aetheris'  },
  { key: 'clank',     name_pt: 'Clank'     },
  { key: 'drakona',   name_pt: 'Drakona'   },
  { key: 'dwarf',     name_pt: 'Anão'      },
  { key: 'earthkin',  name_pt: 'Terrânio'  },
  { key: 'elf',       name_pt: 'Elfo'      },
  { key: 'emberkin',  name_pt: 'Braseado'  },
  { key: 'faerie',    name_pt: 'Fada'      },
  { key: 'faun',      name_pt: 'Fauno'     },
  { key: 'firbolg',   name_pt: 'Firbolg'   },
  { key: 'fungril',   name_pt: 'Fungril'   },
  { key: 'galapa',    name_pt: 'Galapa'    },
  { key: 'giant',     name_pt: 'Gigante'   },
  { key: 'gnome',     name_pt: 'Gnomo'     },
  { key: 'goblin',    name_pt: 'Goblin'    },
  { key: 'halfling',  name_pt: 'Halfling'  },
  { key: 'human',     name_pt: 'Humano'    },
  { key: 'infernis',  name_pt: 'Infernis'  },
  { key: 'katari',    name_pt: 'Katari'    },
  { key: 'orc',       name_pt: 'Orc'       },
  { key: 'ribbet',    name_pt: 'Ribbet'    },
  { key: 'simiah',    name_pt: 'Simiah'    },
  { key: 'skykin',    name_pt: 'Céurio'    },
  { key: 'tidekin',   name_pt: 'Marante'   },
] as const

export type DhAncestryKey = (typeof DH_ANCESTRIES)[number]['key']

export const DH_COMMUNITIES = [
  { key: 'duneborne',   name_pt: 'Dunaborn'    },
  { key: 'freeborne',   name_pt: 'Livrenasc.'  },
  { key: 'frostborne',  name_pt: 'Glacionasc.' },
  { key: 'hearthborne', name_pt: 'Larnasc.'    },
  { key: 'highborne',   name_pt: 'Altonasc.'   },
  { key: 'loreborne',   name_pt: 'Sabernasc.'  },
  { key: 'orderborne',  name_pt: 'Ordenasc.'   },
  { key: 'reborne',     name_pt: 'Renascido'   },
  { key: 'ridgeborne',  name_pt: 'Crista'      },
  { key: 'seaborne',    name_pt: 'Marinhos'    },
  { key: 'slyborne',    name_pt: 'Arteiros'    },
  { key: 'underborne',  name_pt: 'Subterr.'    },
  { key: 'warborne',    name_pt: 'Guerreiros'  },
  { key: 'wanderborne', name_pt: 'Errantes'    },
  { key: 'wildborne',   name_pt: 'Silvestres'  },
] as const

export type DhCommunityKey = (typeof DH_COMMUNITIES)[number]['key']

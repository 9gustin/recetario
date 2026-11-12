/** Pedidos para generar el catálogo: cada uno produce ~10 recetas originales. Rápidas, en español rioplatense. */
export type Brief = { id: string; text: string; maxMinutes: number; tags: string[] };

const b = (id: string, text: string, maxMinutes = 30, tags: string[] = []): Brief => ({
  id,
  text,
  maxMinutes,
  tags,
});

export const BRIEFS: Brief[] = [
  // Desayunos y meriendas
  b("desayuno-5min", "desayunos listos en 5 a 10 minutos", 10, ["desayuno", "rápido"]),
  b("desayuno-salado", "desayunos salados con huevo, queso o palta", 15, ["desayuno"]),
  b("tostadas-sandwiches", "tostadas, tostados y sándwiches completos", 15, [
    "desayuno",
    "merienda",
  ]),
  b("avena-cereales", "avena, overnight oats y bowls de cereales y frutas", 10, [
    "desayuno",
    "liviano",
  ]),
  b("panqueques-tortitas", "panqueques, tortitas y waffles simples", 25, ["desayuno", "merienda"]),
  b("licuados-bebidas", "licuados, smoothies y bebidas frías", 10, ["bebida", "rápido"]),
  b("meriendas-dulces", "meriendas dulces caseras sin complicaciones", 30, ["merienda"]),
  b("snacks-saludables", "snacks saludables para llevar", 15, ["snack", "liviano"]),
  // Almuerzo / cena base
  b("ensaladas-completas", "ensaladas completas que funcionan como plato único", 20, [
    "ensalada",
    "liviano",
  ]),
  b("wraps-tacos", "wraps, burritos y tacos fáciles", 25, ["rápido"]),
  b("pastas-20", "pastas listas en 20 minutos", 20, ["pasta", "rápido"]),
  b("salsas-pasta", "salsas caseras para pasta (rápidas)", 20, ["pasta", "salsa"]),
  b("arroces-olla", "arroces y risottos en una sola olla", 30, ["arroz", "una olla"]),
  b("guisos-rapidos", "guisos y estofados rápidos", 40, ["guiso"]),
  b("sopas-cremas", "sopas y cremas de verdura rápidas", 30, ["sopa", "liviano"]),
  b("tartas-pizzas", "tartas, pizzas y fugazzetas rápidas", 40, ["tarta"]),
  b("empanadas-masas", "empanadas, tortillas y masas simples", 40, ["empanada"]),
  b("milanesas-rebozados", "milanesas y rebozados al horno o a la sartén", 30, ["milanesa"]),
  b("pollo-30", "platos de pollo en menos de 30 minutos", 30, ["pollo", "rápido"]),
  b("carne-vacuna", "carne vacuna rápida (bifes, carne picada, salteados)", 30, ["carne"]),
  b("cerdo", "cerdo rápido (bondiola, solomillo, bifes)", 35, ["cerdo"]),
  b("pescado-mariscos", "pescados y mariscos simples", 25, ["pescado"]),
  b("huevos", "huevos de muchas formas como plato principal", 20, ["huevo", "rápido"]),
  b("legumbres-rapidas", "legumbres rápidas (lentejas, garbanzos, porotos)", 35, ["legumbres"]),
  b("verduras-horno", "verduras al horno y gratinadas", 40, ["verdura"]),
  b("salteados-wok", "salteados al wok o a la sartén", 25, ["salteado", "rápido"]),
  b("air-fryer", "recetas para freidora de aire", 25, ["airfryer"]),
  b("una-bandeja", "cenas en una sola bandeja de horno", 45, ["horno", "una bandeja"]),
  b("sin-horno", "platos sin horno, solo sartén u olla", 25, ["sin horno"]),
  b("hamburguesas-sandwiches", "hamburguesas y sándwiches calientes", 25, ["sándwich"]),
  b("guarniciones", "guarniciones y acompañamientos rápidos", 25, ["guarnición"]),
  b("aderezos-salsas", "aderezos, salsas y dips caseros", 10, ["salsa"]),
  // Dietas y necesidades
  b("sin-gluten", "platos sin gluten (sin TACC) naturalmente", 30, ["sin gluten"]),
  b("sin-lacteos", "platos sin lácteos", 30, ["sin lácteos"]),
  b("vegetarianas", "platos vegetarianos completos", 30, ["vegetariano"]),
  b("veganas", "platos veganos completos", 30, ["vegano"]),
  b("economicas", "platos muy económicos con ingredientes baratos", 35, ["económico"]),
  b("meal-prep-freezar", "recetas para cocinar en tanda y freezar", 45, ["para freezar"]),
  b("bajas-carbo", "platos bajos en carbohidratos", 30, ["bajo en carbohidratos"]),
  b("livianas", "platos livianos y bajos en calorías", 25, ["liviano"]),
  b("altas-proteina", "platos altos en proteína", 30, ["alto en proteína"]),
  b("para-ninos", "platos que les gustan a los chicos", 30, ["para chicos"]),
  b("para-compartir", "picadas, tablas y platos para compartir", 25, ["para compartir"]),
  b("cenas-livianas", "cenas livianas para el final del día", 25, ["cena", "liviano"]),
  // Postres
  b("postres-rapidos", "postres rápidos (menos de 30 minutos)", 30, ["postre"]),
  b("postres-sin-horno", "postres sin horno", 25, ["postre", "sin horno"]),
  b("dulces-fruta", "postres y dulces con fruta", 25, ["postre", "fruta"]),
  // Cocinas del mundo y clásicos
  b(
    "clasicos-argentinos",
    "clásicos de la cocina argentina de todos los días en versión rápida",
    40,
    ["argentina"],
  ),
  b("italiana", "cocina italiana casera rápida", 30, ["italiana"]),
  b("mexicana", "cocina mexicana casera rápida", 30, ["mexicana"]),
  b("asiatica", "cocina asiática casera rápida (china, tailandesa, japonesa, coreana)", 30, [
    "asiática",
  ]),
  b("mediterranea", "cocina mediterránea y griega", 30, ["mediterránea"]),
  b("india-curries", "currys y platos de inspiración india", 35, ["india"]),
  b("peruana-latam", "cocina peruana, colombiana y venezolana casera", 35, ["latinoamericana"]),
  b("arabe", "cocina árabe y de Medio Oriente casera", 35, ["árabe"]),
  b("espanola", "cocina española casera rápida", 35, ["española"]),
  b("estacion-verano", "platos frescos de verano", 25, ["verano"]),
  b("estacion-invierno", "platos reconfortantes de invierno", 45, ["invierno"]),
  b("sobras", "recetas para aprovechar sobras (arroz, pollo, pan, verduras)", 25, ["sobras"]),
];

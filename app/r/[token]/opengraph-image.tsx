import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { getPublicRecipe } from "@/lib/recipes/public";

export const alt = "Receta compartida";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagen de preview (WhatsApp, etc.): no puede usar las clases de tokens, así que repite los colores
// del tema "noche" (docs/design y SPEC §8.1).
const BG = "#191411";
const FG = "#F5EDE3";
const ACCENT = "#F2A541";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const recipe = await getPublicRecipe(token);
  const title = recipe?.title ?? BRAND.name;
  const by = recipe?.shared_by.name?.trim();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: BG,
        color: FG,
      }}
    >
      {recipe?.image_url ? (
        <img
          src={recipe.image_url}
          alt=""
          style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: "linear-gradient(to top, rgba(25,20,17,0.95) 10%, rgba(25,20,17,0.15) 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 56,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, color: ACCENT, letterSpacing: 2 }}>
          {BRAND.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
        {by ? <div style={{ fontSize: 32 }}>{`Compartida por ${by}`}</div> : null}
      </div>
    </div>,
    size,
  );
}

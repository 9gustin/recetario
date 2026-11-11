"use client";

import Link from "next/link";
import { ChevronLeft, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { Hero } from "@/components/shared/hero";
import { PillButton } from "@/components/shared/pill-button";
import { SectionTitle } from "@/components/shared/section-title";
import { useDayPart } from "@/components/theme/day-part-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DAY_PART_PREFERENCES, DAY_PARTS, type DayPart } from "@/lib/theme/day-part";

const LABELS = {
  auto: "Automático",
  mediodia: "Mediodía",
  tarde: "Tarde",
  noche: "Noche",
} as const;

function Panel({ dayPart }: { dayPart: DayPart }) {
  return (
    <div
      data-daypart={dayPart}
      className="w-[375px] shrink-0 overflow-hidden rounded-card border border-border bg-background text-foreground"
    >
      <Hero
        className="min-h-[360px]"
        meta="Miércoles 11 · Casa"
        topRight={
          <span className="rounded-full bg-background/50 px-2.5 py-1.5 text-xs font-bold">
            18:10
          </span>
        }
        eyebrow="Esta noche"
        title="Salmón con rúcula y palta"
        subtitle="8 pasos · 25 min · apta para los dos"
        action={
          <PillButton variant="primary">
            <Play fill="currentColor" /> Empezar a cocinar
          </PillButton>
        }
      />

      <div className="flex flex-col gap-4 p-4">
        <SectionTitle action={<span className="text-sm font-semibold text-accent">Ver todo</span>}>
          El resto del día
        </SectionTitle>

        <div className="flex flex-wrap gap-2">
          <PillButton size="md">Principal</PillButton>
          <PillButton size="md" variant="inverse">
            Inverso
          </PillButton>
          <PillButton size="md" variant="outline">
            Borde
          </PillButton>
          <PillButton size="md" variant="soft">
            Suave
          </PillButton>
        </div>

        <Card className="bg-surface">
          <CardHeader>
            <CardTitle className="font-display text-[22px] font-normal">Pollo al limón</CardTitle>
            <CardDescription>35 min · 4 porciones</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge>Apta</Badge>
            <Badge variant="outline">Sin gluten</Badge>
            <span className="text-sm font-semibold text-success">Cumplido</span>
            <span className="text-sm font-semibold text-danger-soft">Prohibido</span>
            <Avatar>
              <AvatarFallback>AV</AvatarFallback>
            </Avatar>
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Label htmlFor={`q-${dayPart}`}>Buscar receta</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              id={`q-${dayPart}`}
              placeholder="Tengo ganas de algo con pollo…"
              className="pl-9"
            />
          </div>
          <Textarea placeholder="Notas de la receta" />
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox /> Ya tengo el aceite
          </label>
        </div>

        <Tabs defaultValue="ing">
          <TabsList>
            <TabsTrigger value="ing">Ingredientes</TabsTrigger>
            <TabsTrigger value="pasos">Pasos</TabsTrigger>
          </TabsList>
          <TabsContent value="ing" className="pt-2 text-sm text-muted">
            2 pechugas, 1 limón, aceite de oliva.
          </TabsContent>
          <TabsContent value="pasos" className="pt-2 text-sm text-muted">
            Salpimentá, sellá y terminá con limón.
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>

        <ScrollArea className="h-16 rounded-xl border border-border p-3 text-sm">
          <p>Texto dentro de un área con scroll. Probá a deslizar.</p>
          <p>Segunda línea.</p>
          <p>Tercera línea.</p>
          <p>Cuarta línea.</p>
        </ScrollArea>

        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Diálogo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Borrar la receta?</DialogTitle>
                <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
                <SheetDescription>Elegí qué querés ver.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Armar con IA</DrawerTitle>
                <DrawerDescription>Contame qué querés comer esta semana.</DrawerDescription>
              </DrawerHeader>
            </DrawerContent>
          </Drawer>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Menú</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Editar</DropdownMenuItem>
              <DropdownMenuItem>Duplicar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => toast("Receta guardada")}>Toast</Button>
        </div>
      </div>
    </div>
  );
}

export function UiGallery() {
  const { dayPart, preference, setPreference } = useDayPart();
  return (
    <main className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2 px-4">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-accent">
          <ChevronLeft className="size-4" /> Volver
        </Link>
        <h1 className="font-display text-3xl">Componentes · tres temas</h1>
        <p className="text-sm text-muted">
          Tema de la página: <strong className="text-foreground">{dayPart}</strong>. Cambia solo con
          la hora; acá podés fijarlo.
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={preference}
          onValueChange={(v) => v && setPreference(v as (typeof DAY_PART_PREFERENCES)[number])}
          className="flex-wrap"
        >
          {DAY_PART_PREFERENCES.map((p) => (
            <ToggleGroupItem key={p} value={p} className="min-h-11">
              {LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex gap-4 overflow-x-auto px-4 pb-4">
        {DAY_PARTS.map((p) => (
          <Panel key={p} dayPart={p} />
        ))}
      </div>
    </main>
  );
}

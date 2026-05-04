"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PosicaoMapa {
  id: string;
  lat: number;
  lng: number;
  nome?: string;
  tipo: "motorista" | "passageiro" | "ponto" | "minha";
  velocidade?: number;
}

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  ordem: number;
}

interface Props {
  posicoes: PosicaoMapa[];
  centro?: [number, number];
  zoom?: number;
  onMapClick?: (lat: number, lng: number) => void;
  rotaPontos?: { lat: number; lng: number }[];
  rotaCor?: string;
  waypoints?: Waypoint[];
}

const ICONES: Record<string, L.DivIcon> = {};

function getIcone(tipo: PosicaoMapa["tipo"]) {
  if (ICONES[tipo]) return ICONES[tipo];
  const configs: Record<string, { bg: string; emoji: string; size: number }> = {
    motorista: { bg: "#d97706", emoji: "🚌", size: 44 },
    passageiro: { bg: "#2563eb", emoji: "🧍", size: 36 },
    ponto:      { bg: "#059669", emoji: "🚏", size: 32 },
    minha:      { bg: "#7c3aed", emoji: "📍", size: 40 },
  };
  const c = configs[tipo];
  ICONES[tipo] = L.divIcon({
    html: `<div style="width:${c.size}px;height:${c.size}px;background:${c.bg};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${c.size * 0.5}px;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:3px solid white">${c.emoji}</div>`,
    className: "",
    iconSize: [c.size, c.size],
    iconAnchor: [c.size / 2, c.size / 2],
  });
  return ICONES[tipo];
}

export default function MapaLeaflet({ posicoes, centro, zoom = 13, onMapClick, rotaPontos, rotaCor = "#0b7336", waypoints = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = centro || [-8.05, -34.9];
    mapRef.current = L.map(containerRef.current, {
      center: defaultCenter,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    // Satélite ESRI (gratuito, sem chave)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "© Esri" }
    ).addTo(mapRef.current);

    // Labels de ruas sobre o satélite
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, opacity: 0.7 }
    ).addTo(mapRef.current);

    if (onMapClick) {
      mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualiza marcadores
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    posicoes.forEach(p => {
      seen.add(p.id);
      const latlng: [number, number] = [p.lat, p.lng];
      if (markersRef.current.has(p.id)) {
        markersRef.current.get(p.id)!.setLatLng(latlng);
      } else {
        const marker = L.marker(latlng, { icon: getIcone(p.tipo) })
          .bindPopup(`<b>${p.nome || p.tipo}</b>${p.velocidade ? `<br>${p.velocidade.toFixed(0)} km/h` : ""}`)
          .addTo(map);
        markersRef.current.set(p.id, marker);
      }
    });

    // Remove marcadores que sumiram
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });
  }, [posicoes]);

  // Desenha rota
  useEffect(() => {
    if (!mapRef.current) return;
    polylineRef.current?.remove();
    if (rotaPontos && rotaPontos.length >= 2) {
      polylineRef.current = L.polyline(
        rotaPontos.map(p => [p.lat, p.lng]),
        { color: rotaCor, weight: 5, opacity: 0.8, dashArray: "10, 6" }
      ).addTo(mapRef.current);
    }
  }, [rotaPontos, rotaCor]);

  // Renderiza waypoints como marcadores numerados pequenos
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const seen = new Set<string>();

    waypoints.forEach((wp, idx) => {
      seen.add(wp.id);
      const latlng: [number, number] = [wp.lat, wp.lng];
      const icon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#6b7280;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:white;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${idx + 1}</div>`,
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      if (waypointMarkersRef.current.has(wp.id)) {
        waypointMarkersRef.current.get(wp.id)!.setLatLng(latlng);
      } else {
        const m = L.marker(latlng, { icon }).addTo(map);
        waypointMarkersRef.current.set(wp.id, m);
      }
    });

    waypointMarkersRef.current.forEach((m, id) => {
      if (!seen.has(id)) { m.remove(); waypointMarkersRef.current.delete(id); }
    });
  }, [waypoints]);

  // Centraliza no primeiro motorista ou centro dado
  useEffect(() => {
    if (!mapRef.current) return;
    if (centro) { mapRef.current.setView(centro, zoom); return; }
    const motorista = posicoes.find(p => p.tipo === "motorista");
    if (motorista) mapRef.current.panTo([motorista.lat, motorista.lng]);
  }, [centro]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

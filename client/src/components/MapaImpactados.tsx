import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correção para os ícones padrão do Leaflet no React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface CepDado {
  id: string;
  tipo: string;
  cep: string;
  endereco_validado?: string;
  pais?: string;
}

interface MapaImpactadosProps {
  ceps: CepDado[];
}

interface MarkerData {
  id: string;
  lat: number;
  lon: number;
  tipo: string;
  cep: string;
  endereco: string;
}

// Componente utilitário para ajustar o zoom do mapa automaticamente para caber todos os pins
const MapFitBounds = ({ markers }: { markers: MarkerData[] }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lon]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [markers, map]);
  return null;
};

const getTipoLabel = (tipo: string): string => {
  const t = tipo.toUpperCase();
  if (t === 'GESTOR') return 'Impactado pelo Gestor';
  if (t === 'SOCIO') return 'Impactado pelo Sócio';
  if (t === 'COLABORADOR') return 'Impactado pelo Colaborador';
  if (t === 'GESTOR_DIRETO') return 'Gestor';
  if (t === 'COLABORADOR_DIRETO') return 'Colaborador';
  if (t === 'SOCIO_DIRETO') return 'Sócio';
  return tipo;
};

const getCustomIcon = (tipo: string) => {
  let color = '#3B82F6'; // Default (Blue)
  const t = tipo.toUpperCase();
  if (t === 'GESTOR') color = '#9333EA'; // Roxo
  else if (t === 'SOCIO') color = '#EAB308'; // Amarelo
  else if (t === 'COLABORADOR') color = '#22C55E'; // Verde
  else if (t === 'GESTOR_DIRETO') color = '#7030A0'; // Roxo escuro
  else if (t === 'COLABORADOR_DIRETO') color = '#0EA5E9'; // Azul
  else if (t === 'SOCIO_DIRETO') color = '#F97316'; // Laranja

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="28" height="40" style="filter: drop-shadow(2px 4px 2px rgba(0,0,0,0.3));"><path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/></svg>`;

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: svgIcon,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40]
  });
};


const MapaImpactados: React.FC<MapaImpactadosProps> = ({ ceps }) => {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoordinates = async () => {
      setLoading(true);
      
      // Filtra apenas os que tem endereço válido
      const cepsComEndereco = ceps.filter(c => c.endereco_validado);

      const markerPromises = cepsComEndereco.map(async (item, i) => {
        try {
          const enderecoOriginal = item.endereco_validado || '';
          const isBrazilianFormat = enderecoOriginal.match(/ - [A-Z]{2}$/);
          const cleanCep = item.cep.replace(/\D/g, '');

          // Se for Brasil e tiver CEP válido, usamos a AwesomeAPI que é rápida e permite paralelo
          if ((item.pais === 'BR' || item.pais === 'Brasil' || isBrazilianFormat) && cleanCep.length === 8) {
            const response = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
            if (response.ok) {
              const data = await response.json();
              if (data.lat && data.lng) {
                return {
                  id: item.id || `temp-${i}`,
                  lat: parseFloat(data.lat),
                  lon: parseFloat(data.lng),
                  tipo: item.tipo,
                  cep: item.cep,
                  endereco: enderecoOriginal
                };
              }
            }
          }

          // Fallback para Nominatim (Internacional ou falha da AwesomeAPI)
          let cleanQuery = '';
          if (item.pais === 'BR' || item.pais === 'Brasil' || isBrazilianFormat) {
            if (enderecoOriginal.includes(' - ')) {
              const parts = enderecoOriginal.split(' - ');
              const uf = parts[1].trim();
              const parteEndereco = parts[0].trim();
              cleanQuery = `${parteEndereco}, ${uf}, Brasil`;
            } else {
              cleanQuery = `${enderecoOriginal}, Brasil`;
            }
          } else {
            cleanQuery = enderecoOriginal.replace(' - ', ', ');
            if (item.pais && item.pais !== 'BR' && item.pais !== 'Brasil') {
              if (!cleanQuery.toLowerCase().includes(item.pais.toLowerCase())) {
                cleanQuery = `${cleanQuery}, ${item.pais}`;
              }
            }
          }

          const query = encodeURIComponent(cleanQuery);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}&email=tecnologia@diversidade.io`
          );
          const data = await response.json();

          if (data && data.length > 0) {
            return {
              id: item.id || `temp-${i}`,
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon),
              tipo: item.tipo,
              cep: item.cep,
              endereco: enderecoOriginal
            };
          }
          return null;
        } catch (error) {
          console.error('Erro ao buscar coordenadas para:', item.endereco_validado, error);
          return null;
        }
      });

      // Executa as buscas e filtra os resultados nulos
      const resolvedMarkers = (await Promise.all(markerPromises)).filter(m => m !== null) as MarkerData[];

      // Adiciona um "jitter" (pequeno deslocamento aleatório de ~20-30 metros)
      // para pins que têm as exatas mesmas coordenadas, evitando que fiquem ocultos um atrás do outro.
      const usedCoords = new Set<string>();
      const finalMarkers = resolvedMarkers.map(marker => {
        let { lat, lon } = marker;
        let coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        
        while (usedCoords.has(coordKey)) {
          // Desloca em um círculo minúsculo
          const ang = Math.random() * Math.PI * 2;
          const radius = 0.0003; // Aprox 30 metros
          lat += Math.cos(ang) * radius;
          lon += Math.sin(ang) * radius;
          coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        }
        
        usedCoords.add(coordKey);
        return { ...marker, lat, lon };
      });

      setMarkers(finalMarkers);
      setLoading(false);
    };

    if (ceps.length > 0) {
      fetchCoordinates();
    } else {
      setLoading(false);
    }
  }, [ceps]);


  if (loading) {
    return (
      <div className="w-full h-[400px] bg-gray-50 flex flex-col items-center justify-center rounded-2xl border border-gray-200 mt-6">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Buscando localizações no mapa...</p>
        <p className="text-xs text-gray-400 mt-2">Isso pode levar alguns segundos dependendo da quantidade de endereços.</p>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="w-full p-6 bg-gray-50 text-center rounded-2xl border border-gray-200 mt-6">
        <p className="text-gray-500">Não foi possível carregar as coordenadas para os endereços informados no mapa.</p>
      </div>
    );
  }

  // Centro padrão (Brasil)
  const defaultCenter: [number, number] = [-14.235004, -51.92528];

  return (
    <div className="w-full h-[400px] mt-6 rounded-2xl overflow-hidden border border-gray-200 relative z-0">
      <MapContainer center={defaultCenter} zoom={4} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker, idx) => (
          <Marker key={`${marker.id}-${idx}`} position={[marker.lat, marker.lon]} icon={getCustomIcon(marker.tipo)}>
            <Popup>
              <div className="text-sm min-w-[200px]">
                <span className="font-bold text-purple-700">{getTipoLabel(marker.tipo)}</span><br />
                <strong>CEP:</strong> {marker.cep}<br />
                {marker.endereco}
              </div>
            </Popup>
          </Marker>
        ))}
        <MapFitBounds markers={markers} />
      </MapContainer>
    </div>
  );
};

export default MapaImpactados;

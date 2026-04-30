import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  WMSTileLayer, 
  LayersControl, 
  useMap,
  Marker,
  Popup,
  GeoJSON
} from 'react-leaflet';
import { 
  Layers, 
  Database, 
  Settings, 
  Map as MapIcon, 
  Activity,
  Globe,
  Plus,
  Info,
  Server,
  Filter,
  Upload,
  FileCode,
  Trash2,
  Palette,
  Check,
  Search,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronRight,
  ChevronLeft,
  Target,
  Eye,
  EyeOff,
  LayoutList,
  TrendingUp,
  Hash,
  ArrowRightLeft,
  ListFilter,
  ChevronDown,
  ChevronUp,
  X,
  Edit,
  Navigation,
  Compass,
  Code2,
  Trash
} from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import axios from 'axios';
import shp from 'shpjs';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'motion/react';
import * as turf from '@turf/turf';
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { 
  Download,
  Copy,
  Save,
  Maximize2,
  GripHorizontal,
  Eraser,
  Ruler,
  MousePointer2,
  BoxSelect
} from 'lucide-react';

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Fix Leaflet icons
import L from 'leaflet';
const L_FIXED = L as any;
const DefaultIcon = L_FIXED.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L_FIXED.Marker.prototype.options.icon = DefaultIcon;

// --- Interfaces ---

interface QueryRule {
  id: string;
  field: string; // for attributes
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'spatial_within' | 'spatial_intersects';
  value: string;
  isSpatial?: boolean;
}

interface LocalGeoJSON {
  id: string;
  name: string;
  data: any;
  visible: boolean;
  style: {
    color: string;
    weight: number;
    fillOpacity: number;
    attribute?: string | null;
    labelField?: string | null;
    categories: Record<string, string>;
  };
  url: string;
  filter: string;
  statsFields?: string[];
  queries: QueryRule[];
  queryConjunction: 'AND' | 'OR';
}

// --- Components ---

const GeomanControl = ({ onUpdate }: { onUpdate: (measurements: any[]) => void }) => {
    const map = useMap();
    
    useEffect(() => {
        if (!map) return;
        
        map.pm.addControls({
            position: 'topleft',
            drawCircleMarker: false,
            rotateMode: false,
            drawMarker: true,
            drawPolyline: true,
            drawRectangle: true,
            drawPolygon: true,
            drawCircle: true,
            editMode: true,
            dragMode: true,
            removalMode: true,
            cutLayer: true,
        });

        map.pm.setGlobalOptions({
            measurements: {
                measurement: true,
            }
        });

        const updateMeasurements = () => {
          const layers = map.pm.getGeomanLayers();
          const measures = layers.map((layer: any, index: number) => {
            const m = layer.pm.getMeasurements();
            let text = "";
            let type = "Geometry";
            if (m.area) {
              text = `${m.area} ${m.areaUnit}`;
              type = "Area";
            } else if (m.distance) {
              text = `${m.distance} ${m.distanceUnit}`;
              type = "Line";
            } else if (layer instanceof L.Marker) {
              const latlng = layer.getLatLng();
              text = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
              type = "Coordinate";
            }
            return { id: index, type, text, layer };
          }).filter(m => m.text);
          onUpdate(measures);
        };

        map.on('pm:create', (e: any) => {
          updateMeasurements();
          e.layer.on('pm:edit pm:dragend pm:rotate pm:cut', updateMeasurements);
          e.layer.on('pm:remove', updateMeasurements);
        });

        map.on('pm:remove', updateMeasurements);

        return () => {
            if (map.pm) map.pm.removeControls();
            map.off('pm:create pm:remove');
        };
    }, [map, onUpdate]);

    return null;
};

const MouseCoordinates = ({ onUpdate }: { onUpdate: (coords: {lat: number, lng: number} | null) => void }) => {
    const map = useMap();

    useEffect(() => {
        const handleMouseMove = (e: any) => {
            onUpdate({ lat: e.latlng.lat, lng: e.latlng.lng });
        };
        map.on('mousemove', handleMouseMove);
        return () => {
            map.off('mousemove', handleMouseMove);
        };
    }, [map, onUpdate]);

    return null;
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const ZoomToLayer: React.FC<{ layerData: any, trigger: number }> = ({ layerData, trigger }) => {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0 && layerData) {
      try {
        const layer = L.geoJSON(layerData);
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch (e) {
        console.error("Could not fit bounds", e);
      }
    }
  }, [trigger, layerData, map]);
  return null;
};

export default function App() {
  const [geoserverUrl, setGeoserverUrl] = useState('/api/geoserver');
  const [layers, setLayers] = useState<any[]>([]);
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [localGeoJSONs, setLocalGeoJSONs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [activeTab, setActiveTab] = useState('layers');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [highlightCategory, setHighlightCategory] = useState<{ layerId: string, attribute: string, value: any } | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [layerRenameText, setLayerRenameText] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<{ layerId: string, featureIndex: number, properties: any, latlng: [number, number] } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomTrigger, setZoomTrigger] = useState<{ id: string, count: number }>({ id: '', count: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [collapsedLegendLayers, setCollapsedLegendLayers] = useState<string[]>([]);
  const [activeMeasurements, setActiveMeasurements] = useState<any[]>([]);
  const [bufferRadius, setBufferRadius] = useState<number>(1.0);
  const [bufferUnits, setBufferUnits] = useState<string>("kilometers");
  const [queryBuilderTarget, setQueryBuilderTarget] = useState<string | null>(null);
  const [mouseCoords, setMouseCoords] = useState<{lat: number, lng: number} | null>(null);

  const applyStructuredQueries = (feature: any, queries: QueryRule[], conjunction: 'AND' | 'OR') => {
    if (queries.length === 0) return true;
    
    const results = queries.map(q => {
      if (!q.field) return true;
      const val = feature.properties[q.field];
      const sVal = String(val).toLowerCase();
      const sQuery = String(q.value).toLowerCase();

      switch (q.operator) {
        case 'equals': return String(val) === String(q.value);
        case 'not_equals': return String(val) !== String(q.value);
        case 'contains': return sVal.includes(sQuery);
        case 'not_contains': return !sVal.includes(sQuery);
        case 'greater_than': return parseFloat(val) > parseFloat(q.value);
        case 'less_than': return parseFloat(val) < parseFloat(q.value);
        case 'is_empty': return val === undefined || val === null || val === "";
        case 'is_not_empty': return val !== undefined && val !== null && val !== "";
        case 'spatial_within': {
          const radius = parseFloat(q.value) || 0;
          if (radius <= 0) return true;
          // For simplicity, within radius of feature's first point or centroid
          const centroid = turf.centroid(feature);
          const mapCenterPoint = turf.point([mapCenter[1], mapCenter[0]]);
          const distance = turf.distance(centroid, mapCenterPoint, { units: 'kilometers' });
          return distance <= radius;
        }
        case 'spatial_intersects': {
          // Check if it intersects any drawn geometry
          if (activeMeasurements.length === 0) return true;
          return activeMeasurements.some(m => {
            try {
              const drawGeo = m.layer.toGeoJSON();
              return turf.booleanIntersects(feature, drawGeo);
            } catch (e) { return false; }
          });
        }
        default: return true;
      }
    });

    if (conjunction === 'OR') return results.some(r => r);
    return results.every(r => r);
  };

  const addQueryRule = (layerId: string) => {
    const layer = localGeoJSONs.find(l => l.id === layerId);
    if (!layer) return;
    const fields = Object.keys(layer.data.features[0]?.properties || {});
    const newRule: QueryRule = {
      id: Math.random().toString(36).substr(2, 9),
      field: fields[0] || '',
      operator: 'contains',
      value: ''
    };
    setLocalGeoJSONs(prev => prev.map(l => l.id === layerId ? { ...l, queries: [...l.queries, newRule] } : l));
  };

  const removeQueryRule = (layerId: string, ruleId: string) => {
    setLocalGeoJSONs(prev => prev.map(l => l.id === layerId ? { ...l, queries: l.queries.filter(r => r.id !== ruleId) } : l));
  };

  const updateQueryRule = (layerId: string, ruleId: string, updates: Partial<QueryRule>) => {
    setLocalGeoJSONs(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      return {
        ...l,
        queries: l.queries.map(r => r.id === ruleId ? { ...r, ...updates } : r)
      };
    }));
  };

  const toggleQueryConjunction = (layerId: string) => {
    setLocalGeoJSONs(prev => prev.map(l => l.id === layerId ? { ...l, queryConjunction: l.queryConjunction === 'AND' ? 'OR' : 'AND' } : l));
  };

  const createBuffer = (layerId: string) => {
    const layer = localGeoJSONs.find(l => l.id === layerId);
    if (!layer || bufferRadius <= 0) return;

    try {
      const buffered = turf.buffer(layer.data as any, bufferRadius, { units: bufferUnits as any });
      const newLayer: any = {
        id: `buffer-${Date.now()}`,
        name: `Buffer ${bufferRadius}${bufferUnits} (${layer.name})`,
        data: buffered,
        visible: true,
        style: { 
          color: '#f59e0b', 
          weight: 2, 
          opacity: 0.8, 
          fillColor: '#f59e0b', 
          fillOpacity: 0.3,
          attribute: null,
          labelField: null,
          categories: {}
        },
        url: '',
        filter: '',
        statsFields: [],
        queries: [],
        queryConjunction: 'AND'
      };
      setLocalGeoJSONs(prev => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
    } catch (error) {
      console.error("Buffer error:", error);
      setError("Analysis failed: Geometry might be invalid");
    }
  };

  const toggleLegendLayer = (layerId: string) => {
    setCollapsedLegendLayers(prev => 
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  };

  const updateFeatureProperties = () => {
    if (!selectedFeature) return;
    setLocalGeoJSONs(prev => prev.map(layer => {
      if (layer.id !== selectedFeature.layerId) return layer;
      const newData = JSON.parse(JSON.stringify(layer.data));
      newData.features[selectedFeature.featureIndex].properties = selectedFeature.properties;
      return { ...layer, data: newData };
    }));
    setIsEditMode(false);
  };

  const saveLayerVersion = (layerId: string) => {
    const sourceLayer = localGeoJSONs.find(l => l.id === layerId);
    if (!sourceLayer) return;

    const newVersion = {
      ...JSON.parse(JSON.stringify(sourceLayer)),
      id: `${Date.now()}-v`,
      name: `${sourceLayer.name} (Snapshot)`,
      queries: [...sourceLayer.queries],
      queryConjunction: sourceLayer.queryConjunction
    };
    setLocalGeoJSONs(prev => [...prev, newVersion]);
  };

  const exportGeoJSON = (layerId: string) => {
    const layer = localGeoJSONs.find(l => l.id === layerId);
    if (!layer) return;
    const blob = new Blob([JSON.stringify(layer.data)], { type: 'application/json' });
    saveAs(blob, `${layer.name}.geojson`);
  };

  const zoomToLayerBounds = (id: string) => {
    setZoomTrigger(prev => ({ id, count: prev.count + 1 }));
  };

  // Fetch tables from PostGIS
  const fetchTables = async () => {
    try {
      const res = await axios.get('/api/tables');
      setDbTables(res.data);
    } catch (err: any) {
      console.warn("Failed to fetch DB tables. Database might not be connected.", err.message);
    }
  };

  const renameLayer = (id: string) => {
    if (!layerRenameText.trim()) return;
    setLocalGeoJSONs(prev => prev.map(l => l.id === id ? { ...l, name: layerRenameText } : l));
    setEditingLayerId(null);
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleShapefileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          try {
            const geojson = await shp(result);
            // shp() can return a single GeoJSON object or an array of them if the zip has multiple
            const newLayers = Array.isArray(geojson) ? geojson : [geojson];
            
            const namedLayers = newLayers.map((g, i) => ({
              id: `${Date.now()}-${i}`,
              name: file.name.replace('.zip', '') + (newLayers.length > 1 ? `_${i}` : ''),
              originalName: file.name.replace('.zip', ''),
              data: g,
              style: {
                color: '#6366f1',
                weight: 2,
                fillOpacity: 0.2,
                attribute: null,
                labelField: null,
                categories: {}
              },
              filter: "",
              visible: true,
              statsFields: [],
              queries: [],
              queryConjunction: 'AND'
            }));

            setLocalGeoJSONs(prev => [...prev, ...namedLayers]);
            
            // Zoom to first new layer if available
            if (namedLayers.length > 0) {
              const firstLayer = namedLayers[0].data;
              // Simple way to get a center point from GeoJSON
              if (firstLayer.features?.length > 0) {
                const geom = firstLayer.features[0].geometry as any;
                const coords = geom.coordinates;
                // Handle different geometry types (Points vs Polygons)
                const point = Array.isArray(coords[0]) ? 
                  (Array.isArray(coords[0][0]) ? coords[0][0] : coords[0]) : 
                  coords;
                if (point[1] && point[0]) {
                  setMapCenter([point[1], point[0]]);
                }
              }
            }
          } catch (err: any) {
            setError("Failed to parse shapefile. Ensure it's a valid ZIP containing .shp, .dbf, etc.");
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError("Error reading file");
    } finally {
      setLoading(false);
    }
  };

  const removeLocalLayer = (id: string) => {
    setLocalGeoJSONs(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const updateLayerStyle = (id: string, newStyle: any) => {
    setLocalGeoJSONs(prev => prev.map(l => l.id === id ? { ...l, style: { ...l.style, ...newStyle } } : l));
  };

  const setLayerFilter = (id: string, query: string) => {
    setLocalGeoJSONs(prev => prev.map(l => l.id === id ? { ...l, filter: query } : l));
  };

  const toggleLayerVisibility = (id: string) => {
    setLocalGeoJSONs(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const toggleStatsField = (layerId: string, field: string) => {
    setLocalGeoJSONs(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      const current = l.statsFields || [];
      const statsFields = current.includes(field) 
        ? current.filter((f: string) => f !== field)
        : [...current, field];
      return { ...l, statsFields };
    }));
  };

  const generateCategoricalStyle = (layerId: string, attribute: string) => {
    const layer = localGeoJSONs.find(l => l.id === layerId);
    if (!layer || !attribute) return;

    const values = layer.data.features.map((f: any) => f.properties[attribute]);
    const numericValues = values.map((v: any) => parseFloat(v)).filter((v: any) => !isNaN(v));
    const uniqueValues = Array.from(new Set(values)).filter(v => v !== undefined && v !== null);
    
    const categories: Record<string, string> = {};

    if (numericValues.length > 0 && uniqueValues.length > 10) {
      // Numerical Classification (Equal Interval)
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const range = max - min;
      const step = range / 5;

      for (let i = 0; i < 5; i++) {
        const start = min + (i * step);
        const end = min + ((i + 1) * step);
        const label = `${start.toFixed(2)} - ${end.toFixed(2)}`;
        categories[label] = PRESET_COLORS[i % PRESET_COLORS.length].value;
      }
      updateLayerStyle(layerId, { attribute, categories, isNumeric: true, min, max, step });
    } else {
      // Standard Categorical
      uniqueValues.forEach((val: any, i) => {
        categories[String(val)] = PRESET_COLORS[i % PRESET_COLORS.length].value;
      });
      updateLayerStyle(layerId, { attribute, categories, isNumeric: false });
    }
  };

  const getLayerInsights = (layer: any) => {
    if (!layer || !layer.data || !layer.data.features) return null;
    
    const allAttributes = Object.keys(layer.data.features[0]?.properties || {});
    const stats: any = {
      total: layer.data.features.length,
      attributes: allAttributes,
      categoricalData: [], // for symbology
      multiFieldStats: []
    };

    // Symbology Insight (categoricalData)
    if (layer.style.attribute) {
      const values = layer.data.features.map((f: any) => f.properties[layer.style.attribute]);
      if (layer.style.isNumeric) {
        const numbers = values.map((v: any) => parseFloat(v)).filter((v: any) => !isNaN(v));
        if (numbers.length > 0) {
          const { min, step } = layer.style;
          const counts: Record<string, number> = {};
          Object.keys(layer.style.categories).forEach(cat => counts[cat] = 0);
          numbers.forEach(val => {
            let index = Math.floor((val - min) / step);
            if (index >= 5) index = 4;
            if (index < 0) index = 0;
            const label = Object.keys(layer.style.categories)[index];
            counts[label]++;
          });
          stats.categoricalData = Object.entries(counts).map(([name, value]) => ({
            name, value, fill: layer.style.categories[name]
          }));
        }
      } else {
        const counts: Record<string, number> = {};
        values.forEach((val: any) => {
          counts[val] = (counts[val] || 0) + 1;
        });
        stats.categoricalData = Object.entries(counts).map(([name, value]) => ({ 
          name, value, fill: layer.style.categories[name] || layer.style.color
        })).sort((a: any, b: any) => b.value - a.value).slice(0, 8);
      }
    }

    // Multi-Field Statistics
    const fieldsToStat = layer.statsFields || [];
    fieldsToStat.forEach((field: string) => {
      const values = layer.data.features.map((f: any) => f.properties[field]);
      const numbers = values.map((v: any) => parseFloat(v)).filter((v: any) => !isNaN(v));
      
      if (numbers.length > 0) {
        const sum = numbers.reduce((a: number, b: number) => a + b, 0);
        stats.multiFieldStats.push({
          field,
          type: 'numeric',
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          avg: sum / numbers.length,
          sum,
          count: numbers.length
        });
      } else {
        // Categorical stats for multi-field
        const counts: Record<string, number> = {};
        values.forEach((v: any) => v !== undefined && (counts[String(v)] = (counts[String(v)] || 0) + 1));
        stats.multiFieldStats.push({
          field,
          type: 'categorical',
          uniqueCount: Object.keys(counts).length,
          topValues: Object.entries(counts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3)
        });
      }
    });

    return stats;
  };

  const PRESET_COLORS = [
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Violet', value: '#8b5cf6' },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans antialiased text-slate-50">
        <Sidebar className="border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
          <SidebarHeader className="p-6 border-b border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/20 flex items-center justify-center p-1">
                  <img 
                    src="https://picsum.photos/seed/cambodia-gis/200/200" 
                    alt="GTC Logo" 
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h1 className="font-black text-sm uppercase tracking-wider text-blue-500 leading-tight">GTC WebMap</h1>
                  <p className="text-[10px] text-indigo-400 font-bold">Cambodia Edition</p>
                </div>
              </div>
              <Badge variant="outline" className="w-fit text-[9px] border-slate-800 text-slate-500 font-mono">
                System Active
              </Badge>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <Tabs defaultValue="layers" onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
                <TabsTrigger value="layers" className="data-[state=active]:bg-indigo-600 transition-all">
                  <Layers className="w-4 h-4 mr-2" />
                  Layers
                </TabsTrigger>
                <TabsTrigger value="data" className="data-[state=active]:bg-indigo-600 transition-all">
                  <Database className="w-4 h-4 mr-2" />
                  Source
                </TabsTrigger>
              </TabsList>

              <TabsContent value="layers" className="mt-4 space-y-4">
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <div className="space-y-4 pr-3">
                    <SidebarGroup>
                      <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Cross-Layer Search Engine</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <div className="relative mt-2">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-400/60" />
                          <Input 
                             placeholder="Search values in all layers..." 
                             className="h-9 pl-9 bg-slate-950 border-slate-800 focus:border-indigo-500 placeholder:text-slate-600 text-xs text-white"
                             value={globalSearchQuery}
                             onChange={(e) => setGlobalSearchQuery(e.target.value)}
                          />
                          {globalSearchQuery && (
                            <X 
                              className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-500 cursor-pointer hover:text-white" 
                              onClick={() => setGlobalSearchQuery('')} 
                            />
                          )}
                        </div>
                      </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup>
                      <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Active Layers</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <div className="space-y-2 mt-2">
                          <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <MapIcon className="w-4 h-4 text-indigo-400" />
                                <div>
                                  <p className="text-sm font-medium">OpenStreetMap</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-mono">Base Map</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 text-[10px] border-none">VISIBLE</Badge>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer group opacity-60">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Server className="w-4 h-4 text-amber-400" />
                                <div>
                                  <p className="text-sm font-medium">GeoServer WMS</p>
                                  <p className="text-[10px] text-slate-500 uppercase font-mono italic">Not Connected</p>
                                </div>
                              </div>
                              <div className="w-2 h-2 rounded-full bg-slate-600" />
                            </div>
                          </div>
                        </div>
                      </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup>
                      <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Spatial Operations</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700">
                            <Plus className="w-3 h-3 mr-2" /> Add WMS
                          </Button>
                          <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700">
                            <Filter className="w-3 h-3 mr-2" /> Query
                          </Button>
                        </div>
                      </SidebarGroupContent>
                    </SidebarGroup>

                    <SidebarGroup>
                      <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest text-white/80">Local Shapefiles (.zip)</SidebarGroupLabel>
                      <SidebarGroupContent>
                        <div className="space-y-2 mt-2">
                           <div className="relative">
                            <Input 
                              type="file" 
                              accept=".zip" 
                              onChange={handleShapefileUpload}
                              className="hidden" 
                              id="shapefile-upload"
                            />
                            <label 
                              htmlFor="shapefile-upload"
                              className="flex items-center justify-center gap-2 p-3 bg-indigo-600/20 border border-dashed border-indigo-500/40 rounded-lg cursor-pointer hover:bg-indigo-600/30 transition-all group w-full"
                            >
                              <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-semibold text-indigo-300">Upload ZIP Shapefile</span>
                            </label>
                          </div>

                          {localGeoJSONs.map((layer) => (
                            <div key={layer.id} className="space-y-2">
                              <div className={`p-4 bg-white rounded-2xl border-2 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${selectedLayerId === layer.id ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-transparent shadow-black/5 hover:border-blue-200'}`}>
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" onClick={() => setSelectedLayerId(selectedLayerId === layer.id ? null : layer.id)}>
                                      <div className={`p-2.5 rounded-xl shadow-inner flex-shrink-0 ${!layer.visible ? 'bg-slate-100 opacity-40' : 'bg-blue-50'}`}>
                                        <FileCode className="w-5 h-5" style={{ color: layer.visible ? layer.style.color : '#94a3b8' }} />
                                      </div>
                                      <div className={`min-w-0 flex-1 ${!layer.visible ? 'opacity-40' : ''}`}>
                                        {editingLayerId === layer.id ? (
                                          <div className="flex items-center gap-1.5">
                                            <Input 
                                              value={layerRenameText}
                                              onChange={(e) => setLayerRenameText(e.target.value)}
                                              className="h-8 text-[11px] py-0 px-2 bg-slate-50 border-blue-500 text-slate-900 font-bold"
                                              autoFocus
                                              onKeyDown={(e) => e.key === 'Enter' && renameLayer(layer.id)}
                                            />
                                            <Button size="icon" className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600" onClick={() => renameLayer(layer.id)}>
                                              <Check className="w-4 h-4 text-white" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div>
                                            <p className="text-xs font-black text-blue-600 leading-tight uppercase tracking-tight break-words">{layer.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[7px] h-3.5 px-1.5 bg-slate-100 text-slate-500 font-bold uppercase tracking-tighter">Vector Layer</Badge>
                                                {layer.style.attribute && <Badge variant="secondary" className="text-[7px] h-3.5 px-1.5 bg-blue-50 text-blue-600 font-bold uppercase tracking-tighter">Styled</Badge>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={`h-9 w-9 rounded-xl transition-all ${layer.visible ? 'text-blue-500 bg-blue-50' : 'text-slate-300 hover:text-blue-400 hover:bg-blue-50'}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLayerVisibility(layer.id);
                                      }}
                                    >
                                      {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </Button>
                                  </div>

                                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                    <div className="flex items-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          zoomToLayerBounds(layer.id);
                                        }}
                                        title="Zoom to Extent"
                                      >
                                        <Maximize2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveLayerVersion(layer.id);
                                        }}
                                        title="Snapshot Version"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          exportGeoJSON(layer.id);
                                        }}
                                        title="Export File"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className={`h-8 w-8 transition-colors ${editingLayerId === layer.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingLayerId(layer.id);
                                          setLayerRenameText(layer.name);
                                        }}
                                        title="Configure Layer"
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeLocalLayer(layer.id);
                                        }}
                                        title="Delete Data"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                                {selectedLayerId === layer.id && (
                                  <div className="mt-3 pt-3 border-t border-slate-700 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div>
                                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Symbology</p>
                                      <div className="grid grid-cols-6 gap-1.5">
                                        {PRESET_COLORS.map((c) => (
                                          <button
                                            key={c.value}
                                            className="w-full aspect-square rounded-md border border-white/10 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
                                            style={{ backgroundColor: c.value }}
                                            onClick={() => updateLayerStyle(layer.id, { color: c.value })}
                                            title={c.name}
                                          >
                                            {layer.style.color === c.value && <Check className="w-3 h-3 text-white" />}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-slate-400 uppercase">Weight</label>
                                        <span className="text-[10px] font-mono text-slate-500">{layer.style.weight}px</span>
                                      </div>
                                      <div className="flex gap-2">
                                        {[1, 2, 4, 6].map(w => (
                                          <Button
                                            key={w}
                                            variant="outline"
                                            size="sm"
                                            className={`h-6 flex-1 text-[10px] ${layer.style.weight === w ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-900 border-slate-700'}`}
                                            onClick={() => updateLayerStyle(layer.id, { weight: w })}
                                          >
                                            {w}px
                                          </Button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-slate-400 uppercase">Transparency</label>
                                        <span className="text-[10px] font-mono text-slate-500">{Math.round(layer.style.fillOpacity * 100)}%</span>
                                      </div>
                                      <div className="px-1">
                                        <input 
                                          type="range" 
                                          min="0" 
                                          max="1" 
                                          step="0.01"
                                          value={layer.style.fillOpacity}
                                          onChange={(e) => updateLayerStyle(layer.id, { fillOpacity: parseFloat(e.target.value) })}
                                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                      </div>
                                    </div>

                                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3 mb-4">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm">
                                          <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-tight">Geospatial Buffer</p>
                                          <p className="text-[8px] text-slate-400 font-bold">Proximity Analysis Tool</p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Radius</label>
                                          <Input 
                                            type="number" 
                                            value={bufferRadius} 
                                            onChange={(e) => setBufferRadius(parseFloat(e.target.value) || 0)}
                                            className="h-8 text-xs bg-white border-slate-200 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Units</label>
                                          <select 
                                            className="w-full h-8 bg-white border border-slate-200 rounded-md text-[11px] px-2 font-medium text-slate-700"
                                            value={bufferUnits}
                                            onChange={(e) => setBufferUnits(e.target.value)}
                                          >
                                            <option value="meters">Meters</option>
                                            <option value="kilometers">Kilometers</option>
                                            <option value="miles">Miles</option>
                                            <option value="feet">Feet</option>
                                          </select>
                                        </div>
                                      </div>
                                      <Button 
                                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/20"
                                        onClick={() => createBuffer(layer.id)}
                                      >
                                        Generate Vector Buffer
                                      </Button>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">Map Labeling</p>
                                      <select 
                                        className="w-full h-8 bg-slate-900 border border-slate-700 rounded text-[11px] px-2 text-slate-300"
                                        value={layer.style.labelField || ""}
                                        onChange={(e) => updateLayerStyle(layer.id, { labelField: e.target.value })}
                                      >
                                        <option value="">No Labels</option>
                                        {Object.keys(layer.data.features[0]?.properties || {}).map(attr => (
                                          <option key={attr} value={attr}>{attr}</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold">Query Engine</p>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 px-2 text-[9px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/5"
                                          onClick={() => setQueryBuilderTarget(layer.id)}
                                        >
                                          <Filter className="w-2.5 h-2.5 mr-1" />
                                          Visual Builder
                                          {layer.queries.length > 0 && <Badge className="ml-1.5 h-3.5 px-1 bg-indigo-500">{layer.queries.length}</Badge>}
                                        </Button>
                                      </div>
                                      <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-500" />
                                        <Input 
                                          placeholder="Quick attribute filter..." 
                                          className="h-8 pl-8 text-[11px] bg-slate-900 border-slate-700 text-white"
                                          value={layer.filter}
                                          onChange={(e) => setLayerFilter(layer.id, e.target.value)}
                                        />
                                      </div>
                                      {layer.queries.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5 flex items-center gap-1">
                                            {layer.queries.length} rules active ({layer.queryConjunction})
                                            <Trash className="w-2 h-2 cursor-pointer hover:text-white" onClick={() => setLocalGeoJSONs(prev => prev.map(l => l.id === layer.id ? { ...l, queries: [] } : l))} />
                                          </Badge>
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold">Categorical Styling</p>
                                      <select 
                                        className="w-full h-8 bg-slate-900 border border-slate-700 rounded text-[11px] px-2 text-slate-300"
                                        value={layer.style.attribute || ""}
                                        onChange={(e) => generateCategoricalStyle(layer.id, e.target.value)}
                                      >
                                        <option value="">Select Attribute...</option>
                                        {Object.keys(layer.data.features[0]?.properties || {}).map(attr => (
                                          <option key={attr} value={attr}>{attr}</option>
                                        ))}
                                      </select>
                                      {layer.style.attribute && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {Object.entries(layer.style.categories).slice(0, 4).map(([name, color]: any) => (
                                            <Badge key={name} className="text-[9px] bg-slate-900 border-slate-700 text-slate-400 font-mono">
                                              <div className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
                                              {name}
                                            </Badge>
                                          ))}
                                          {Object.keys(layer.style.categories).length > 4 && (
                                            <Badge className="text-[9px] bg-slate-900 border-slate-700 text-slate-500">+{Object.keys(layer.style.categories).length - 4} more</Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-[10px] text-slate-400 uppercase font-bold flex justify-between">
                                        Statistic Fields
                                        <Badge variant="outline" className="h-3.5 text-[8px] border-indigo-500/30 text-indigo-400">DASHBOARD</Badge>
                                      </p>
                                      <ScrollArea className="h-24 bg-slate-900/50 rounded border border-slate-700/50 p-2">
                                        <div className="space-y-1">
                                          {Object.keys(layer.data.features[0]?.properties || {}).map(attr => (
                                            <div key={attr} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded" onClick={() => toggleStatsField(layer.id, attr)}>
                                              <div className={`w-3 h-3 rounded-sm border border-slate-600 flex items-center justify-center transition-colors ${(layer.statsFields || []).includes(attr) ? 'bg-indigo-500 border-indigo-500' : ''}`}>
                                                {(layer.statsFields || []).includes(attr) && <Check className="w-2.5 h-2.5 text-white" />}
                                              </div>
                                              <span className="text-[10px] text-slate-400 truncate">{attr}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="data" className="mt-4 space-y-4">
                <ScrollArea className="h-[calc(100vh-250px)]">
                   <div className="space-y-4 pr-3">
                    <SidebarGroup>
                      <SidebarGroupLabel className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Database Tables (PostGIS)</SidebarGroupLabel>
                      <SidebarGroupContent>
                        {dbTables.length > 0 ? (
                          <div className="space-y-1 mt-2">
                            {dbTables.map((table) => (
                              <div key={table.table_name} className="flex items-center justify-between p-2 hover:bg-slate-800 rounded transition-colors cursor-pointer group">
                                <div className="flex items-center gap-2">
                                  <Database className="w-3 h-3 text-emerald-400" />
                                  <span className="text-xs font-mono text-slate-300">{table.table_name}</span>
                                </div>
                                <Info className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center p-6 bg-slate-800/20 rounded-lg border border-dashed border-slate-700 mt-2">
                             <Activity className="w-6 h-6 text-slate-600 mx-auto mb-2 opacity-50" />
                             <p className="text-[10px] text-slate-500">Configure DATABASE_URL to see PostGIS tables</p>
                          </div>
                        )}
                      </SidebarGroupContent>
                    </SidebarGroup>

                    <div className="p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-tighter mb-2">Connection Status</h4>
                      <div className="space-y-2">
                         <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                            <span className="text-[10px] text-slate-400 uppercase">GeoServer</span>
                            <Badge variant="outline" className="text-[9px] border-amber-500/50 text-amber-500 px-1 py-0 h-4 uppercase">PENDING</Badge>
                         </div>
                         <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                            <span className="text-[10px] text-slate-400 uppercase">PostgreSQL</span>
                            <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500 px-1 py-0 h-4 uppercase">DISCONNECTED</Badge>
                         </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </SidebarContent>

          <div className="mt-auto p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
               <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">JD</div>
               <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate italic">Spatial Analyst</p>
                  <p className="text-[9px] text-slate-500 uppercase">Pro License</p>
               </div>
               <Settings className="w-4 h-4 text-slate-500 hover:text-indigo-400 cursor-pointer" />
            </div>
          </div>
        </Sidebar>

        <SidebarInset className="relative flex-1 bg-slate-950 flex flex-col h-screen overflow-hidden">
          {/* Top Bar Header */}
          <div className="h-14 bg-slate-950 border-b border-white/5 flex items-center justify-between px-6 z-[1010] shadow-sm">
             <div className="flex items-center gap-4">
                <SidebarTrigger className="bg-slate-900 border-slate-800 hover:bg-slate-800" />
                <div className="h-6 w-[1px] bg-slate-800 mx-1" />
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-indigo-400" />
                   </div>
                   <h2 className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-200">Analytical Dashboard</h2>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                {/* Visual Coords Indicator */}
                {mouseCoords && (
                  <div className="flex items-center bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl gap-4">
                    <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
                      <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Lat</span>
                      <span className="text-[10px] font-mono text-white font-bold">{mouseCoords.lat.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pr-1">
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Lng</span>
                      <span className="text-[10px] font-mono text-white font-bold">{mouseCoords.lng.toFixed(5)}</span>
                    </div>
                    <Navigation className="w-3 h-3 text-slate-500 animate-pulse" />
                  </div>
                )}
                
                {/* Result Quick Summary */}
                <div className="hidden lg:flex items-center bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-xl gap-3">
                   <div className="flex items-center gap-2">
                      <Ruler className="w-3 h-3 text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-400 leading-none">{activeMeasurements.length} Measures</span>
                   </div>
                   <div className="h-3 w-[1px] bg-indigo-500/30" />
                   <div className="flex items-center gap-2">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 leading-none">{localGeoJSONs.filter(l => l.visible).length} Active</span>
                   </div>
                </div>

                <div className="h-6 w-[1px] bg-slate-800 mx-1" />
                
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className={`h-9 px-4 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${showInsights ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                   onClick={() => setShowInsights(!showInsights)}
                >
                   <Activity className="w-3.5 h-3.5 mr-2" />
                   {showInsights ? 'Close Insights' : 'Open Insights'}
                </Button>
                <div className="h-6 w-[1px] bg-slate-800" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
                   <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin-slow" />
                   <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Spatial Navigator</span>
                </div>
             </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
             {/* Top-Docked Insights Dashboard */}
             <AnimatePresence>
                {showInsights && (
                   <motion.div 
                     initial={{ y: -300, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     exit={{ y: -300, opacity: 0 }}
                     className="absolute top-0 left-0 right-0 z-[1005] bg-slate-950/95 backdrop-blur-3xl border-b border-indigo-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
                   >
                     <div className="h-[280px] p-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
                        <div className="flex gap-6 h-full pb-4 items-start">
                          {activeMeasurements.length > 0 && (
                            <div className="min-w-[320px] flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xl ring-1 ring-black/5 h-full">
                               <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Ruler className="w-4 h-4 text-blue-600" />
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tighter">Geometric Results</h4>
                                  </div>
                                  <Badge className="bg-blue-100 text-blue-600 border-none text-[8px] font-black uppercase">Active Tool</Badge>
                               </div>
                               <ScrollArea className="flex-1">
                                  <div className="space-y-2">
                                     {activeMeasurements.map((m, idx) => (
                                       <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-colors">
                                          <div className="flex items-center gap-3">
                                             <div className={`p-1.5 rounded-md ${m.type === 'Area' ? 'bg-amber-100' : m.type === 'Line' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                                                <MousePointer2 className={`w-3 h-3 ${m.type === 'Area' ? 'text-amber-600' : m.type === 'Line' ? 'text-emerald-600' : 'text-blue-600'}`} />
                                             </div>
                                             <div>
                                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{m.type}</p>
                                                <p className="text-xs font-mono font-black text-slate-800">{m.text}</p>
                                             </div>
                                          </div>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => m.layer.remove()}>
                                             <X className="w-3 h-3 text-slate-400" />
                                          </Button>
                                       </div>
                                     ))}
                                  </div>
                               </ScrollArea>
                            </div>
                          )}

                          {localGeoJSONs.filter(l => l.visible).map(layer => {
                            const insights = getLayerInsights(layer);
                            return (
                              <div key={`dash-${layer.id}`} className="min-w-[420px] flex flex-col gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50 ring-1 ring-white/5 h-full">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-indigo-400" />
                                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-tight truncate max-w-[150px]">{layer.name}</h4>
                                  </div>
                                  <div className="flex gap-3 text-[10px] font-mono text-slate-500">
                                      <span>FT: <span className="text-indigo-400">{insights?.total}</span></span>
                                      <span>ATTR: <span className="text-emerald-400">{insights?.attributes.length}</span></span>
                                  </div>
                                </div>

                                <ScrollArea className="flex-1">
                                  <div className="grid grid-cols-2 gap-4">
                                    {insights?.categoricalData.length > 0 && (
                                      <div className="col-span-1 space-y-2">
                                        <p className="text-[9px] text-slate-500 uppercase flex items-center gap-1.5 border-b border-slate-800 pb-1">
                                          <PieChartIcon className="w-2.5 h-2.5" />
                                          Categorical: {layer.style.attribute}
                                        </p>
                                        <div className="h-[100px] w-full mt-2">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={insights.categoricalData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                              <XAxis dataKey="name" hide />
                                              <YAxis hide />
                                              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                                {insights.categoricalData.map((entry: any, index: number) => (
                                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                              </Bar>
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </div>
                                    )}

                                    {insights?.multiFieldStats.length > 0 ? (
                                      <div className="col-span-1 grid grid-cols-1 gap-2">
                                        {insights.multiFieldStats.map((stat: any) => (
                                          <div key={stat.field} className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[9px] font-bold text-slate-300 uppercase truncate">{stat.field}</span>
                                              <Badge className="text-[8px] h-3.5 bg-indigo-500/20 text-indigo-400 border-none">{stat.type === 'numeric' ? 'NUM' : 'CAT'}</Badge>
                                            </div>
                                            <p className="text-xs font-mono text-white font-bold">{stat.type === 'numeric' ? stat.avg.toFixed(1) : stat.uniqueCount}</p>
                                            <p className="text-[7px] text-slate-500 uppercase tracking-widest">{stat.type === 'numeric' ? 'Average' : 'Unique Values'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="col-span-1 flex flex-col items-center justify-center bg-slate-950/30 rounded-lg border border-dashed border-slate-800 p-2">
                                        <p className="text-[8px] text-slate-600 uppercase font-black text-center">No Stats Fields Selected</p>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </div>
                            );
                          })}
                        </div>
                     </div>
                   </motion.div>
                )}
             </AnimatePresence>

             <MapContainer 
               center={[20, 0]} 
               zoom={3} 
               style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
               zoomControl={false}
             >
              <MapController center={mapCenter} />
              
              {localGeoJSONs.map(l => (
                <ZoomToLayer key={`zoom-${l.id}`} layerData={l.data} trigger={zoomTrigger.id === l.id ? zoomTrigger.count : 0} />
              ))}
              
              <LayersControl position="bottomright">
                <LayersControl.BaseLayer checked name="Carto Dark">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Carto Voyage">
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap &copy; CARTO'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="OSM Standard">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Google Satellite">
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    attribution='&copy; Google'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Google Hybrid">
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    attribution='&copy; Google'
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Esri World Imagery">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                  />
                </LayersControl.BaseLayer>

                {/* Example GeoServer WMS Layer */}
                {/* 
                <LayersControl.Overlay name="Cities (GeoServer)">
                   <WMSTileLayer
                    url={`${geoserverUrl}/ows`}
                    layers="topp:states"
                    format="image/png"
                    transparent={true}
                  />
                </LayersControl.Overlay> 
                */}
              </LayersControl>

              <GeomanControl onUpdate={setActiveMeasurements} />
              <MouseCoordinates onUpdate={setMouseCoords} />

              {/* Local GeoJSON Layers from Shapefiles */}
              {localGeoJSONs.filter(l => l.visible).map((layer) => (
                <GeoJSON 
                  key={layer.id} 
                  data={layer.data} 
                  filter={(feature) => {
                    const localSearchStr = layer.filter.toLowerCase();
                    const globalSearchStr = globalSearchQuery.toLowerCase();
                    
                    const matchesLocal = !layer.filter || Object.values(feature.properties || {}).some(
                      val => String(val).toLowerCase().includes(localSearchStr)
                    );
                    
                    const matchesGlobal = !globalSearchQuery || Object.values(feature.properties || {}).some(
                      val => String(val).toLowerCase().includes(globalSearchStr)
                    );

                    const matchesStructured = applyStructuredQueries(feature, layer.queries, layer.queryConjunction);

                    return matchesLocal && matchesGlobal && matchesStructured;
                  }}
                  style={(feature) => {
                    const baseStyle = {
                      weight: layer.style.weight,
                      opacity: layer.style.fillOpacity,
                      fillOpacity: layer.style.fillOpacity,
                      color: layer.style.color,
                      fillColor: layer.style.color
                    };

                    const globalSearchStr = globalSearchQuery.toLowerCase();
                    const isGlobalMatch = globalSearchQuery && Object.values(feature.properties || {}).some(
                        val => String(val).toLowerCase().includes(globalSearchStr)
                    );

                    if (isGlobalMatch) {
                        baseStyle.weight = layer.style.weight + 3;
                        baseStyle.color = '#fff';
                        baseStyle.fillOpacity = 0.8;
                    }

                    if (layer.style.attribute && feature?.properties) {
                      const val = feature.properties[layer.style.attribute];
                      
                      // Highlight logic
                      const isHighlighted = highlightCategory && 
                                           highlightCategory.layerId === layer.id && 
                                           highlightCategory.attribute === layer.style.attribute && 
                                           String(highlightCategory.value) === String(val);

                      if (layer.style.isNumeric) {
                        const numVal = parseFloat(val);
                        if (!isNaN(numVal)) {
                          const { min, step } = layer.style;
                          let index = Math.floor((numVal - min) / step);
                          if (index >= 5) index = 4;
                          if (index < 0) index = 0;
                          const catColor = Object.values(layer.style.categories)[index] as string;
                          baseStyle.color = isHighlighted ? '#ffffff' : catColor;
                          baseStyle.fillColor = catColor;
                          if (isHighlighted) {
                            baseStyle.weight = layer.style.weight + 4;
                            baseStyle.fillOpacity = 0.9;
                          } else if (highlightCategory && highlightCategory.layerId === layer.id) {
                            baseStyle.opacity = 0.3;
                            baseStyle.fillOpacity = 0.1;
                          }
                        }
                      } else {
                        const catColor = layer.style.categories[String(val)];
                        if (catColor) {
                          baseStyle.color = isHighlighted ? '#ffffff' : catColor;
                          baseStyle.fillColor = catColor;
                          if (isHighlighted) {
                            baseStyle.weight = layer.style.weight + 4;
                            baseStyle.fillOpacity = 0.9;
                          } else if (highlightCategory && highlightCategory.layerId === layer.id) {
                            baseStyle.opacity = 0.3;
                            baseStyle.fillOpacity = 0.1;
                          }
                        }
                      }
                    }

                    return baseStyle;
                  }}
                  onEachFeature={(feature, leafletLayer) => {
                    // Labeling logic
                    if (layer.style.labelField && feature?.properties && feature.properties[layer.style.labelField]) {
                        leafletLayer.bindTooltip(String(feature.properties[layer.style.labelField]), {
                            permanent: true,
                            direction: 'center',
                            className: 'custom-map-label'
                        });
                    } else {
                        leafletLayer.unbindTooltip();
                    }

                    leafletLayer.on('click', (e) => {
                        const featureIndex = layer.data.features.findIndex((f: any) => f === feature);
                        setSelectedFeature({
                            layerId: layer.id,
                            featureIndex,
                            properties: { ...feature.properties },
                            latlng: [e.latlng.lat, e.latlng.lng]
                        });
                        setIsEditMode(false);
                    });
                  }}
                />
              ))}

              {selectedFeature && (
                <AnimatePresence>
                  <motion.div 
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    drag
                    dragMomentum={false}
                    className="absolute top-20 left-1/3 z-[1005] bg-slate-900 shadow-2xl rounded-2xl border border-slate-800 w-[320px] overflow-hidden backdrop-blur-xl"
                  >
                    <div className="bg-gradient-to-r from-indigo-600/20 to-slate-900 border-b border-white/5 p-4 cursor-grab active:cursor-grabbing flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                         <div className="bg-indigo-500/20 p-1.5 rounded-lg border border-indigo-500/30">
                            <Target className="w-4 h-4 text-indigo-400" />
                         </div>
                         <div>
                            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-tight">Attribute Editor</h3>
                            <p className="text-[9px] text-slate-500 uppercase font-mono italic">Floating Controller</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <GripHorizontal className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                        <X className="w-4 h-4 text-slate-600 cursor-pointer hover:text-white" onClick={() => setSelectedFeature(null)} />
                      </div>
                    </div>

                    <div className="p-5 space-y-5">
                      <div className="flex items-center justify-between">
                         <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] h-4">
                           {localGeoJSONs.find(l => l.id === selectedFeature.layerId)?.name}
                         </Badge>
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className={`h-7 px-3 text-[10px] rounded-full border border-dashed transition-all ${isEditMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                           onClick={() => setIsEditMode(!isEditMode)}
                         >
                            <Edit className="w-3 h-3 mr-1.5" />
                            {isEditMode ? 'Editing Active' : 'Enable Edit'}
                         </Button>
                      </div>

                      <ScrollArea className="h-[300px] pr-3 -mr-3">
                        <div className="space-y-4">
                          {Object.entries(selectedFeature.properties).map(([key, val]) => (
                            <div key={key} className="space-y-1.5 bg-slate-950/30 p-2 rounded-lg border border-white/5">
                              <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{key}</label>
                              {isEditMode ? (
                                <Input 
                                  value={String(val)}
                                  onChange={(e) => setSelectedFeature({
                                    ...selectedFeature,
                                    properties: { ...selectedFeature.properties, [key]: e.target.value }
                                  })}
                                  className="h-8 text-[11px] bg-slate-950 border-slate-800 focus:border-indigo-500/50 ring-0"
                                />
                              ) : (
                                <p className="text-xs font-medium text-slate-200 break-words leading-relaxed">{String(val)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {isEditMode && (
                      <div className="p-4 bg-slate-950/40 border-t border-slate-800/50 flex gap-3">
                         <Button variant="ghost" size="sm" className="flex-1 text-[11px] text-slate-500 hover:text-white" onClick={() => setIsEditMode(false)}>Discard</Button>
                         <Button variant="default" size="sm" className="flex-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20" onClick={updateFeatureProperties}>
                           <Save className="w-3 h-3 mr-2" /> Commit Changes
                         </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}



              {/* Integrated Right Sidebar: Smart Legend */}
              <div className={`absolute top-0 right-0 z-[1003] bg-slate-950/80 backdrop-blur-2xl border-l border-slate-800 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-500 ease-in-out bottom-11 ${showLegend ? 'w-[280px]' : 'w-0 overflow-hidden border-none opacity-0'} pointer-events-none`}>
                <div className="p-5 border-b border-white/5 bg-white/5 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                      <ListFilter className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-white">Legend</h3>
                      <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">Active Datasets</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] border-slate-800 text-slate-500">
                      {localGeoJSONs.filter(l => l.visible && l.style.attribute).length}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-slate-500 hover:text-white"
                      onClick={() => setShowLegend(false)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 pointer-events-auto custom-scrollbar">
                  <div className="p-5 space-y-4">
                    {localGeoJSONs.filter(l => l.visible && l.style.attribute).map(layer => {
                      const isCollapsed = collapsedLegendLayers.includes(layer.id);
                      return (
                        <div key={`legend-fixed-${layer.id}`} className="space-y-3 group animate-in fade-in slide-in-from-right-4 duration-500 bg-white/5 p-3 rounded-xl border border-white/5">
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleLegendLayer(layer.id)}
                          >
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCollapsed ? 'bg-slate-600' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-tight break-words">{layer.name}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              {layer.style.isNumeric && (
                                <Badge className="text-[8px] h-3.5 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 uppercase font-mono">Q</Badge>
                              )}
                              {isCollapsed ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronUp className="w-3 h-3 text-slate-500" />}
                            </div>
                          </div>
                          
                          {!isCollapsed && (
                            <div className="space-y-1.5 pl-3 border-l-2 border-slate-800/50 ml-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <p className="text-[9px] text-slate-500 font-bold uppercase mb-2 tracking-wide">Prop: {layer.style.attribute}</p>
                              {Object.entries(layer.style.categories).map(([val, color]: any) => (
                                <div 
                                  key={val} 
                                  className={`flex items-center gap-3 p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${highlightCategory?.value === val ? 'bg-indigo-500/20 ring-1 ring-indigo-500/40' : 'hover:bg-white/5'}`}
                                  onMouseEnter={() => setHighlightCategory({ layerId: layer.id, attribute: layer.style.attribute!, value: val })}
                                  onMouseLeave={() => setHighlightCategory(null)}
                                >
                                  <div className="w-3 h-3 rounded-md flex-shrink-0 shadow-inner border border-white/10" style={{ backgroundColor: color }} />
                                  <span className={`text-[10px] truncate transition-colors ${highlightCategory?.value === val ? 'text-indigo-200 font-bold' : 'text-slate-400 group-hover:text-slate-300 font-medium'}`}>{val}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {localGeoJSONs.filter(l => l.visible && l.style.attribute).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="p-4 bg-slate-900 rounded-full mb-4 ring-1 ring-white/5">
                          <LayoutList className="w-6 h-6 text-slate-700" />
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-loose">
                          No Active Symbology<br/>
                          To display
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="px-5 py-3 bg-slate-950 border-t border-white/5 pointer-events-auto">
                   <div className="flex items-center justify-between opacity-50">
                      <p className="text-[8px] text-slate-500 uppercase font-mono font-bold tracking-tighter">System Engine V.2.1 Stable</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   </div>
                </div>
              </div>

              {/* Legend Re-open Handle */}
              {!showLegend && (
                <div 
                  className={`absolute right-0 z-[1004] transition-all duration-500 bottom-11 pointer-events-auto`}
                >
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-10 w-6 rounded-l-xl rounded-r-none bg-slate-900/80 backdrop-blur border border-slate-800 border-r-0 shadow-2xl hover:bg-indigo-600 transition-colors group"
                    onClick={() => setShowLegend(true)}
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-white" />
                  </Button>
                </div>
              )}

              {/* Fixed Bottom Footer Bar (Moved insights to top) */}
              <div className="absolute bottom-0 left-0 right-0 z-[1005] h-11 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 px-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Map Ready</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-500">
                  <span className="uppercase">GTC WebMap Engine v4.2</span>
                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                  <span>&copy; 2026 Cambodia GIS Research</span>
                </div>
              </div>
            </MapContainer>
          </div>
        </SidebarInset>

        <Dialog open={!!queryBuilderTarget} onOpenChange={(open) => !open && setQueryBuilderTarget(null)}>
          <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-400" />
                Advanced Attribute Query Builder
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Construct rule-based filters for <b>{localGeoJSONs.find(l => l.id === queryBuilderTarget)?.name}</b>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filter Logic</p>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-7 px-4 text-[10px] uppercase font-bold rounded-md transition-all ${localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queryConjunction === 'AND' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    onClick={() => queryBuilderTarget && toggleQueryConjunction(queryBuilderTarget)}
                  >
                    Match All (AND)
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-7 px-4 text-[10px] uppercase font-bold rounded-md transition-all ${localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queryConjunction === 'OR' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    onClick={() => queryBuilderTarget && toggleQueryConjunction(queryBuilderTarget)}
                  >
                    Match Any (OR)
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-[350px] pr-4">
                <div className="space-y-3">
                  {localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queries.map((rule, idx) => {
                    const fields = Object.keys(localGeoJSONs.find(l => l.id === queryBuilderTarget)?.data.features[0]?.properties || {});
                    return (
                      <div key={rule.id} className="flex gap-2 items-start bg-slate-900/40 p-3 rounded-xl border border-slate-800 group hover:border-slate-700 transition-colors">
                        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-500">
                          {idx + 1}
                        </div>
                        
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <select 
                              className="w-full h-8 bg-slate-950 border border-slate-800 rounded text-[11px] px-2 text-slate-200 outline-none focus:border-indigo-500"
                              value={rule.field}
                              onChange={(e) => queryBuilderTarget && updateQueryRule(queryBuilderTarget, rule.id, { field: e.target.value })}
                            >
                              {fields.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          
                          <div className="col-span-3">
                            <select 
                              className="w-full h-8 bg-slate-950 border border-slate-800 rounded text-[11px] px-2 text-slate-200 outline-none focus:border-indigo-500"
                              value={rule.operator}
                              onChange={(e) => {
                                const op = e.target.value;
                                const updates: any = { operator: op };
                                if (op.startsWith('spatial_')) {
                                  updates.isSpatial = true;
                                  updates.field = '_geometry';
                                } else {
                                  updates.isSpatial = false;
                                }
                                queryBuilderTarget && updateQueryRule(queryBuilderTarget, rule.id, updates);
                              }}
                            >
                              <optgroup label="Properties">
                                <option value="equals">Equals</option>
                                <option value="not_equals">Not Equals</option>
                                <option value="contains">Contains</option>
                                <option value="not_contains">Does Not Contain</option>
                                <option value="greater_than">Greater Than</option>
                                <option value="less_than">Less Than</option>
                                <option value="is_empty">Is Empty</option>
                                <option value="is_not_empty">Is Not Empty</option>
                              </optgroup>
                              <optgroup label="Spatial">
                                <option value="spatial_within">Within Radius (KM) of Center</option>
                                <option value="spatial_intersects">Intersects Drawn Geometry</option>
                              </optgroup>
                            </select>
                          </div>

                          <div className="col-span-5">
                            {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && rule.operator !== 'spatial_intersects' && (
                              <Input 
                                className="h-8 text-[11px] bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 outline-none"
                                placeholder={rule.operator === 'spatial_within' ? "Distance in KM..." : "Value..."}
                                value={rule.value}
                                onChange={(e) => queryBuilderTarget && updateQueryRule(queryBuilderTarget, rule.id, { value: e.target.value })}
                              />
                            )}
                            {rule.operator === 'spatial_intersects' && (
                              <div className="h-8 flex items-center px-3 bg-slate-950 rounded border border-slate-800 text-[9px] text-indigo-400 font-bold uppercase italic">
                                {activeMeasurements.length > 0 ? `${activeMeasurements.length} Drawn Shapes Active` : 'No Drawn Shapes Found'}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => queryBuilderTarget && removeQueryRule(queryBuilderTarget, rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {(localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queries.length || 0) === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
                      <Filter className="w-10 h-10 text-slate-700 mx-auto mb-3 opacity-20" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Active Rules</p>
                      <p className="text-[10px] text-slate-600 mt-1">Add rules to start filtering your vector data</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <Button 
                variant="outline" 
                className="w-full h-10 border-dashed border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/50 rounded-xl transition-all"
                onClick={() => queryBuilderTarget && addQueryRule(queryBuilderTarget)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Constraint Rule
              </Button>
            </div>

            <DialogFooter className="border-t border-white/5 pt-4">
              <div className="flex-1 flex items-center">
                 <p className="text-[9px] text-slate-500 uppercase font-mono italic">
                   Matches: <span className="text-indigo-400 font-bold">{
                     localGeoJSONs.find(l => l.id === queryBuilderTarget)?.data.features.filter((f: any) => 
                       applyStructuredQueries(f, localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queries || [], localGeoJSONs.find(l => l.id === queryBuilderTarget)?.queryConjunction || 'AND')
                     ).length
                   } </span> 
                   of {localGeoJSONs.find(l => l.id === queryBuilderTarget)?.data.features.length} features
                 </p>
              </div>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 rounded-xl h-10"
                onClick={() => setQueryBuilderTarget(null)}
              >
                Apply Constraints
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}

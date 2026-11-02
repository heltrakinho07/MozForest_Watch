import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { formatArea } from "../lib/api.js";

export default function AnnualChart({ rows = [], selectedYear, onYearChange }) {
  return <div className="chart-body">
    {!rows.length ? <div className="empty-plot">Execute a análise para visualizar os resultados anuais.</div>
      : <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
                  onClick={(e) => { if (e?.activeLabel) onYearChange(Number(e.activeLabel)); }}>
          <CartesianGrid stroke="#273b34" strokeDasharray="3 5" vertical={false}/>
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#90A69D" }} axisLine={false}
                 tickLine={false} interval={3}/>
          <YAxis tick={{ fontSize: 10, fill: "#90A69D" }} axisLine={false}
                 tickLine={false} width={42} tickFormatter={formatArea}/>
          <Tooltip contentStyle={{background:"#122b24",border:"1px solid #325346",borderRadius:12,color:"#EFF8F2"}}
                   itemStyle={{ color: "#9EF4B2" }}
                   formatter={value => [formatArea(value) + " ha", "Perda"]}
                   labelFormatter={year => "Ano " + year}/>
          <ReferenceLine x={selectedYear} stroke="#d4ff91" strokeDasharray="3 3"/>
          <Bar dataKey="loss_ha" name="Perda" fill="#46c58e" activeBar={{fill:"#c4fc8e"}} radius={[3, 3, 0, 0]}/>
        </BarChart>
      </ResponsiveContainer>}
  </div>;
}

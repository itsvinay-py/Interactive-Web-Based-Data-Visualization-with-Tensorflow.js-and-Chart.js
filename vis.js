let dataset = [], columns = [];
let chartjsInstance = null;

document.getElementById('fileInput').addEventListener('change', handleFile, false);
document.getElementById('chartType').addEventListener('change', showHideRadius, false);

function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const lines = evt.target.result.trim().split('\n');
        columns = lines[0].split(',').map(h => h.trim());
        dataset = lines.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim());
            let obj = {};
            columns.forEach((col, idx) => obj[col] = values[idx]);
            return obj;
        });
        populateSelectors();
    };
    reader.readAsText(file);
}

function populateSelectors() {
    ['xCol', 'yCol', 'rCol'].forEach(selId => {
        const sel = document.getElementById(selId);
        sel.innerHTML = '';
        columns.forEach(col => {
            let option = document.createElement('option');
            option.value = col;
            option.text = col;
            sel.add(option.cloneNode(true));
        });
    });
}

function tryParse(val) {
    const num = parseFloat(val);
    return isNaN(num) ? val : num;
}

function aggregateBarData(xCol, yCol) {
    let dataMap = {};
    dataset.forEach(row => {
        let xVal = row[xCol], yVal = tryParse(row[yCol]);
        if (!(xVal in dataMap)) dataMap[xVal] = 0;
        dataMap[xVal] += isNaN(yVal) ? 0 : yVal;
    });
    return Object.keys(dataMap).map(x => ({ index: x, value: dataMap[x] }));
}

function buildHeatmap(xCol, yCol) {
    let yGroups = [...new Set(dataset.map(r => r[yCol]))];
    let xGroups = [...new Set(dataset.map(r => r[xCol]))];
    let values = xGroups.map(x =>
        yGroups.map(y => {
            let yVal = dataset.find(row => row[xCol] == x && row[yCol] == y);
            return yVal ? tryParse(yVal[yCol]) : 0;
        })
    );
    return { values, xTickLabels: xGroups, yTickLabels: yGroups };
}

function getColumnValues(col) {
    return dataset.map(row => tryParse(row[col]));
}

function showHideRadius() {
    const t = document.getElementById('chartType').value;
    document.getElementById('radiusLabel').style.display =
        (t === 'bubble') ? 'flex' : 'none';
}

function drawVisualization() {
    // tfjs-vis rendering target
    const surface = document.getElementById('demo');
    surface.innerHTML = '';
    document.getElementById('chartjs-canvas').style.display = 'none';
    if (chartjsInstance) { chartjsInstance.destroy(); chartjsInstance = null; }

    const chartType = document.getElementById('chartType').value;
    const xCol = document.getElementById('xCol').value;
    const yCol = document.getElementById('yCol').value;
    const rCol = document.getElementById('rCol').value;

    if (!dataset.length || !xCol || (!yCol && !['pie', 'radar', 'treemap', 'waterfall'].includes(chartType))) return;

    // tfjs-vis charts
    if (chartType === 'scatter') {
        let values = dataset.map(row => ({
            x: tryParse(row[xCol]),
            y: tryParse(row[yCol])
        }));
        tfvis.render.scatterplot(surface, { values }, {
            xLabel: xCol, yLabel: yCol, width: 600, height: 370, fontSize: 14
        });
    } else if (chartType === 'barchart') {
        let barData = aggregateBarData(xCol, yCol);
        tfvis.render.barchart(surface, barData, { xLabel: xCol, yLabel: yCol, width: 600 });
    } else if (chartType === 'linechart') {
        let values = dataset.map(row => ({
            x: tryParse(row[xCol]),
            y: tryParse(row[yCol])
        }));
        tfvis.render.linechart(surface, { values: [values], series: [yCol]}, {
            xLabel: xCol, yLabel: yCol, width: 600, height: 370
        });
    } else if (chartType === 'histogram') {
        let values = getColumnValues(yCol);
        tfvis.render.histogram(surface, values, { width: 600, height: 370 });
    } else if (chartType === 'heatmap') {
        let heatmapData = buildHeatmap(xCol, yCol);
        tfvis.render.heatmap(surface, heatmapData, {
            width: 600, height: 370, xLabel: xCol, yLabel: yCol
        });
    } else if (chartType === 'bubble') {
        let values = dataset.map(row => ({
            x: tryParse(row[xCol]),
            y: tryParse(row[yCol]),
            size: rCol ? tryParse(row[rCol]) : 10
        }));
        tfvis.render.scatterplot(surface, { values }, {
            xLabel: xCol, yLabel: yCol, width: 600, height: 370,
            fontSize: 14, sizeAccessor: d => d.size * 4 // scale up visual radius
        });
    }
    // Chart.js charts
    else {
        const ctx = document.getElementById('chartjs-canvas').getContext('2d');
        document.getElementById('chartjs-canvas').style.display = 'block';
        let labels = getColumnValues(xCol).map(x => x + "");
        let data = getColumnValues(yCol);

        let chartData = {};
        if (chartType === 'pie') {
            // group by label for pie
            let pieData = {};
            dataset.forEach(row => {
                let k = row[xCol], v = tryParse(row[yCol]);
                if (!(k in pieData)) pieData[k] = 0;
                pieData[k] += isNaN(v) ? 0 : v;
            });
            labels = Object.keys(pieData);
            data = Object.values(pieData);
            chartData = {
                labels,
                datasets: [{ data, backgroundColor: genColors(labels.length) }]
            };
        }
        else if (chartType === 'radar') {
            chartData = {
                labels,
                datasets: [{
                    label: yCol,
                    data,
                    backgroundColor: "rgba(54, 162, 235, 0.2)",
                    borderColor: "rgba(54, 162, 235, 1)"
                }]
            };
        }
        else if (chartType === 'area') {
            chartData = {
                labels,
                datasets: [{
                    label: yCol,
                    data,
                    borderColor: "rgba(255,99,132,1)",
                    backgroundColor: "rgba(255,99,132,0.3)",
                    fill: true
                }]
            };
        }
        else if (chartType === 'treemap') {
            // Simplified "tree map" as a bar with area for demo -- for real tree map, use Plotly.js
            chartData = {
                labels,
                datasets: [{
                    label: yCol,
                    data,
                    backgroundColor: genColors(labels.length)
                }]
            };
        }
        else if (chartType === 'waterfall') {
            // Simulate a waterfall: bar chart with cumulative sums
            let wLabels = [], wData = [];
            let sum = 0;
            dataset.forEach(row => {
                wLabels.push(row[xCol]);
                let val = tryParse(row[yCol]);
                sum += isNaN(val) ? 0 : val;
                wData.push(sum);
            });
            chartData = {
                labels: wLabels,
                datasets: [{
                    label: yCol,
                    data: wData,
                    backgroundColor: genColors(wLabels.length)
                }]
            };
        }

        let config = {};
        if (chartType === 'pie') {
            config = { type: 'pie', data: chartData };
        } else if (chartType === 'radar') {
            config = { type: 'radar', data: chartData };
        } else if (chartType === 'area') {
            config = {
                type: 'line',
                data: chartData,
                options: { elements: { line: { fill: true } } }
            };
        } else if (chartType === 'treemap' || chartType === 'waterfall') {
            config = { type: 'bar', data: chartData };
        }
        chartjsInstance = new Chart(ctx, config);
    }
}

function genColors(n) {
    let colors = [];
    const baseColors = [
        "#6970dd","#fd7e14","#dc3545","#28a745","#fd51e8","#12bbb6", "#cbd725","#9681f7","#b3d374","#ff9a9a"
    ];
    for (let i = 0; i < n; i++) colors.push(baseColors[i % baseColors.length]);
    return colors;
}

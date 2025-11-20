import React from 'react';
import PropTypes from 'prop-types';

const GRID_SIZE = 20;

function coordKey(x, y) {
  return `${x},${y}`;
}

export default function GameBoard({ snake = [], food = null }) {
  const snakeSet = new Set();

  snake.forEach((seg) => {
    if (Array.isArray(seg) && seg.length >= 2) {
      snakeSet.add(coordKey(seg[0], seg[1]));
    } else if (seg && typeof seg === 'object' && 'x' in seg && 'y' in seg) {
      snakeSet.add(coordKey(seg.x, seg.y));
    }
  });

  let foodKey = null;
  if (food) {
    if (Array.isArray(food) && food.length >= 2) foodKey = coordKey(food[0], food[1]);
    else if (food && typeof food === 'object' && 'x' in food && 'y' in food) foodKey = coordKey(food.x, food.y);
  }

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
    width: '400px',
    height: '400px',
    gap: '2px',
    backgroundColor: '#111',
  };

  const cellBase = {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    boxSizing: 'border-box',
  };

  const cells = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = coordKey(col, row);
      let style = { ...cellBase };
      if (key === foodKey) style = { ...style, backgroundColor: '#e74c3c' };
      else if (snakeSet.has(key)) style = { ...style, backgroundColor: '#2ecc71' };

      cells.push(<div key={key} style={style} data-x={col} data-y={row} />);
    }
  }

  return (
    <div style={containerStyle} role="grid" aria-label="Game board">
      {cells}
    </div>
  );
}

GameBoard.propTypes = {
  snake: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
    ])
  ),
  food: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
  ]),
};
// Create a GameBoard component that renders a 20x20 grid using divs.
// Each cell should be a square and styled with CSS.
// The component should accept props: snake and food positions.

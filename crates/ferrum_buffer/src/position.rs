//! Position types for text locations

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;

/// A point in a document (line, column)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Point {
  pub line: usize,
  pub column: usize,
}

impl Point {
  /// Create a new point
  pub const fn new(line: usize, column: usize) -> Self {
    Self { line, column }
  }

  /// Create a point at the origin (0, 0)
  pub const fn zero() -> Self {
    Self { line: 0, column: 0 }
  }

  /// Check if this is the origin
  pub const fn is_zero(&self) -> bool {
    self.line == 0 && self.column == 0
  }
}

impl Default for Point {
  fn default() -> Self {
    Self::zero()
  }
}

impl PartialOrd for Point {
  fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
    Some(self.cmp(other))
  }
}

impl Ord for Point {
  fn cmp(&self, other: &Self) -> Ordering {
    match self.line.cmp(&other.line) {
      Ordering::Equal => self.column.cmp(&other.column),
      ord => ord,
    }
  }
}

/// A position with additional metadata
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Position {
  /// The point (line, column)
  pub point: Point,
  /// The absolute character offset
  pub offset: usize,
}

impl Position {
  /// Create a new position
  pub const fn new(point: Point, offset: usize) -> Self {
    Self { point, offset }
  }

  /// Create a position at the origin
  pub const fn zero() -> Self {
    Self {
      point: Point::zero(),
      offset: 0,
    }
  }

  /// Get the line number
  pub const fn line(&self) -> usize {
    self.point.line
  }

  /// Get the column number
  pub const fn column(&self) -> usize {
    self.point.column
  }
}

impl Default for Position {
  fn default() -> Self {
    Self::zero()
  }
}

/// A range of text between two positions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Range {
  pub start: Position,
  pub end: Position,
}

impl Range {
  /// Create a new range
  pub const fn new(start: Position, end: Position) -> Self {
    Self { start, end }
  }

  /// Create an empty range at a position
  pub const fn empty(position: Position) -> Self {
    Self {
      start: position,
      end: position,
    }
  }

  /// Check if the range is empty
  pub const fn is_empty(&self) -> bool {
    self.start.offset == self.end.offset
  }

  /// Get the length in characters
  pub const fn len(&self) -> usize {
    self.end.offset - self.start.offset
  }

  /// Check if a position is within this range
  pub fn contains(&self, position: &Position) -> bool {
    position.offset >= self.start.offset && position.offset < self.end.offset
  }

  /// Check if two ranges overlap
  pub fn overlaps(&self, other: &Range) -> bool {
    self.start.offset < other.end.offset && other.start.offset < self.end.offset
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_point_ordering() {
    let p1 = Point::new(0, 5);
    let p2 = Point::new(1, 0);
    let p3 = Point::new(1, 5);

    assert!(p1 < p2);
    assert!(p2 < p3);
    assert!(p1 < p3);
  }

  #[test]
  fn test_range_contains() {
    let range = Range::new(
      Position::new(Point::new(0, 0), 0),
      Position::new(Point::new(0, 10), 10),
    );

    assert!(range.contains(&Position::new(Point::new(0, 5), 5)));
    assert!(!range.contains(&Position::new(Point::new(0, 10), 10)));
  }

  #[test]
  fn test_range_overlaps() {
    let r1 = Range::new(
      Position::new(Point::new(0, 0), 0),
      Position::new(Point::new(0, 10), 10),
    );
    let r2 = Range::new(
      Position::new(Point::new(0, 5), 5),
      Position::new(Point::new(0, 15), 15),
    );
    let r3 = Range::new(
      Position::new(Point::new(0, 10), 10),
      Position::new(Point::new(0, 20), 20),
    );

    assert!(r1.overlaps(&r2));
    assert!(!r1.overlaps(&r3));
  }
}

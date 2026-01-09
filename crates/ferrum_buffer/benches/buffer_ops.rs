//! Benchmarks for buffer operations

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use ferrum_buffer::Buffer;

fn benchmark_insert(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_insert");

    for size in [100, 1000, 10000, 100000].iter() {
        let content: String = "x".repeat(*size);

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            let buffer = Buffer::with_content(&content);
            b.iter(|| {
                buffer.insert(black_box(size / 2), black_box("inserted text")).unwrap();
            });
        });
    }

    group.finish();
}

fn benchmark_delete(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_delete");

    for size in [100, 1000, 10000, 100000].iter() {
        let content: String = "x".repeat(*size);

        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, _| {
            let buffer = Buffer::with_content(&content);
            b.iter(|| {
                // Re-insert to have something to delete
                buffer.insert(0, "test").unwrap();
                buffer.delete(black_box(0), black_box(4)).unwrap();
            });
        });
    }

    group.finish();
}

fn benchmark_line_access(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_line_access");

    for lines in [100, 1000, 10000].iter() {
        let content: String = (0..*lines).map(|i| format!("Line {}\n", i)).collect();

        group.bench_with_input(BenchmarkId::from_parameter(lines), lines, |b, &lines| {
            let buffer = Buffer::with_content(&content);
            b.iter(|| {
                buffer.line(black_box(lines / 2))
            });
        });
    }

    group.finish();
}

criterion_group!(benches, benchmark_insert, benchmark_delete, benchmark_line_access);
criterion_main!(benches);

# Visual Coding (Node-based) 상세 스펙

> **핵심 가치**: "복잡한 로직을 시각적으로 표현하여, 코드 흐름을 직관적으로 이해하고 구성한다"

## 1. 개요

### 1.1 컨셉

**Code ↔ Visual 양방향 동기화**
- 코드를 편집하면 비주얼 노드가 업데이트
- 노드를 수정하면 코드가 업데이트
- 실시간 동기화 (Compile-time Preview와 통합)

**사용 사례:**
1. **복잡한 데이터 흐름**: API → Transform → Filter → Render
2. **상태 머신**: 상태 전환 시각화
3. **조건 분기**: if/switch 흐름도
4. **이벤트 핸들링**: 이벤트 → 핸들러 → 액션

### 1.2 PixiJS 기반 렌더링

**선택 이유:**
- WebGPU/WebGL2 고성능
- 캔버스 기반 (DOM 오버헤드 없음)
- 풍부한 인터랙션
- 애니메이션 지원

---

## 2. 노드 시스템

### 2.1 노드 타입

```typescript
export enum NodeType {
    // Data
    Variable = 'variable',
    Constant = 'constant',
    Parameter = 'parameter',

    // Operations
    FunctionCall = 'function_call',
    Operator = 'operator',
    Assignment = 'assignment',

    // Control Flow
    If = 'if',
    Switch = 'switch',
    Loop = 'loop',

    // I/O
    Input = 'input',
    Output = 'output',
    Event = 'event',

    // Custom
    Component = 'component', // React/Vue Component
    API = 'api',
    Database = 'database',
}

export interface VisualNode {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    size: { width: number; height: number };

    // 데이터
    label: string;
    value?: any;

    // 포트
    inputs: NodePort[];
    outputs: NodePort[];

    // 스타일
    color: string;
    icon?: string;

    // 연결
    connections: Connection[];

    // 원본 코드 위치
    code_range?: Range;
}

export interface NodePort {
    id: string;
    label: string;
    type: DataType;
    is_exec?: boolean; // 실행 흐름용
}

export interface Connection {
    from_node: string;
    from_port: string;
    to_node: string;
    to_port: string;

    // 스타일
    color?: string;
    width?: number;
}
```

### 2.2 언어별 노드 매핑

#### JavaScript/TypeScript

**함수 호출 → 노드:**
```typescript
// Code
const result = processData(input, { format: 'json' });

// Visual Node
┌─────────────────────┐
│   processData       │
├─────────────────────┤
│ ← input: any        │
│ ← options: Object   │
│   → result: any     │
└─────────────────────┘
```

**조건문 → 분기 노드:**
```typescript
// Code
if (user.isPremium) {
    sendEmail(user);
} else {
    showPopup(user);
}

// Visual
        ┌─────────┐
        │   if    │
        │ premium?│
        └────┬────┘
         true│  │false
    ┌────────┘  └────────┐
┌───▼────┐         ┌────▼────┐
│sendEmail│         │showPopup│
└────────┘          └─────────┘
```

**체이닝 → 파이프라인:**
```typescript
// Code
data
    .filter(x => x > 0)
    .map(x => x * 2)
    .reduce((a, b) => a + b);

// Visual
┌──────┐   ┌──────┐   ┌─────┐   ┌────────┐
│ data │──→│filter│──→│ map │──→│ reduce │
└──────┘   └──────┘   └─────┘   └────────┘
```

#### React/Vue Component

```tsx
// Code
<UserProfile
    user={user}
    onUpdate={(data) => handleUpdate(data)}
/>

// Visual Node
┌───────────────────────┐
│   UserProfile         │
│   (Component)         │
├───────────────────────┤
│ ← user: User          │
│ → onUpdate: Function  │
└───────────────────────┘
```

---

## 3. Code → Visual 변환

### 3.1 AST 분석 (Tree-sitter)

```rust
pub struct VisualCodeGenerator {
    tree: Tree,
    node_graph: NodeGraph,
}

impl VisualCodeGenerator {
    pub fn generate(&mut self, buffer: &TextBuffer) -> NodeGraph {
        self.node_graph.clear();

        let root = self.tree.root_node();
        self.traverse(root, buffer);

        // 레이아웃 계산
        self.layout_nodes();

        self.node_graph.clone()
    }

    fn traverse(&mut self, node: Node, buffer: &TextBuffer) {
        match node.kind() {
            "function_declaration" => {
                self.create_function_node(node, buffer);
            }
            "call_expression" => {
                self.create_call_node(node, buffer);
            }
            "if_statement" => {
                self.create_if_node(node, buffer);
            }
            "binary_expression" => {
                self.create_operator_node(node, buffer);
            }
            _ => {
                // 자식 노드 순회
                for child in node.children(&mut node.walk()) {
                    self.traverse(child, buffer);
                }
            }
        }
    }

    fn create_call_node(&mut self, node: Node, buffer: &TextBuffer) -> NodeId {
        // 함수 이름 추출
        let function_node = node.child_by_field_name("function").unwrap();
        let function_name = buffer.text_in_range(function_node.byte_range());

        // 인자 추출
        let args_node = node.child_by_field_name("arguments").unwrap();
        let mut inputs = Vec::new();

        for arg in args_node.named_children(&mut args_node.walk()) {
            inputs.push(NodePort {
                id: format!("arg_{}", inputs.len()),
                label: format!("arg{}", inputs.len()),
                type: DataType::Any,
                is_exec: false,
            });
        }

        // 노드 생성
        let node_id = self.node_graph.add_node(VisualNode {
            type: NodeType::FunctionCall,
            label: function_name,
            inputs,
            outputs: vec![NodePort {
                id: "result".to_string(),
                label: "result".to_string(),
                type: DataType::Any,
                is_exec: false,
            }],
            code_range: Some(node.range().into()),
            ..Default::default()
        });

        node_id
    }
}
```

### 3.2 데이터 흐름 분석

```rust
pub struct DataFlowAnalyzer {
    // 변수 정의 → 사용 추적
    def_use_chains: HashMap<String, Vec<NodeId>>,
}

impl DataFlowAnalyzer {
    pub fn analyze(&mut self, node_graph: &NodeGraph) {
        // 1. 변수 정의 찾기
        for node in &node_graph.nodes {
            if node.type == NodeType::Assignment {
                let var_name = &node.label;
                self.def_use_chains.entry(var_name.clone())
                    .or_insert_with(Vec::new)
                    .push(node.id);
            }
        }

        // 2. 변수 사용 찾기
        for node in &node_graph.nodes {
            for input in &node.inputs {
                if let Some(var_name) = self.get_variable_name(input) {
                    // 정의 노드와 연결
                    if let Some(def_nodes) = self.def_use_chains.get(&var_name) {
                        if let Some(def_node) = def_nodes.last() {
                            self.create_connection(*def_node, node.id);
                        }
                    }
                }
            }
        }
    }
}
```

---

## 4. Visual → Code 변환

### 4.1 노드 그래프 → AST

```rust
pub struct CodeGenerator {
    language: LanguageId,
}

impl CodeGenerator {
    pub fn generate(&self, node_graph: &NodeGraph) -> String {
        match self.language {
            LanguageId::TypeScript => self.generate_typescript(node_graph),
            LanguageId::Python => self.generate_python(node_graph),
            _ => String::new(),
        }
    }

    fn generate_typescript(&self, graph: &NodeGraph) -> String {
        let mut code = String::new();

        // 토폴로지 정렬 (의존성 순서)
        let sorted_nodes = self.topological_sort(graph);

        for node_id in sorted_nodes {
            let node = graph.get_node(node_id).unwrap();

            match node.type {
                NodeType::FunctionCall => {
                    let args = node.inputs
                        .iter()
                        .map(|p| self.get_port_value(p, graph))
                        .collect::<Vec<_>>()
                        .join(", ");

                    code.push_str(&format!("{}({});\n", node.label, args));
                }
                NodeType::If => {
                    let condition = self.get_port_value(&node.inputs[0], graph);
                    code.push_str(&format!("if ({}) {{\n", condition));

                    // true 분기
                    let true_branch = self.get_connected_nodes(node_id, "true", graph);
                    for n in true_branch {
                        code.push_str(&self.generate_node_code(n, graph));
                    }

                    code.push_str("} else {\n");

                    // false 분기
                    let false_branch = self.get_connected_nodes(node_id, "false", graph);
                    for n in false_branch {
                        code.push_str(&self.generate_node_code(n, graph));
                    }

                    code.push_str("}\n");
                }
                _ => {}
            }
        }

        code
    }
}
```

### 4.2 실시간 동기화

```rust
pub struct VisualCodeSync {
    code_to_visual: VisualCodeGenerator,
    visual_to_code: CodeGenerator,

    // 현재 상태
    current_graph: NodeGraph,
    current_code: String,

    // 동기화 방향
    last_edited: EditSource,
}

pub enum EditSource {
    Code,
    Visual,
}

impl VisualCodeSync {
    pub fn on_code_edit(&mut self, buffer: &TextBuffer) {
        if self.last_edited == EditSource::Visual {
            // Visual → Code 변환 중이므로 스킵
            self.last_edited = EditSource::Code;
            return;
        }

        // Code → Visual
        self.current_graph = self.code_to_visual.generate(buffer);
        self.last_edited = EditSource::Code;

        // Frontend로 업데이트 전송
        self.emit_graph_update();
    }

    pub fn on_visual_edit(&mut self, graph: &NodeGraph) {
        if self.last_edited == EditSource::Code {
            // Code → Visual 변환 중이므로 스킵
            self.last_edited = EditSource::Visual;
            return;
        }

        // Visual → Code
        self.current_code = self.visual_to_code.generate(graph);
        self.last_edited = EditSource::Visual;

        // 버퍼 업데이트
        self.update_buffer();
    }
}
```

---

## 5. 레이아웃 알고리즘

### 5.1 자동 배치 (Dagre/Elk)

```typescript
import ELK from 'elkjs';

export class NodeLayoutEngine {
    private elk = new ELK();

    async layout(graph: NodeGraph): Promise<NodeGraph> {
        // ELK 포맷으로 변환
        const elkGraph = this.toElkGraph(graph);

        // 레이아웃 계산
        const laidOut = await this.elk.layout(elkGraph);

        // 노드 위치 업데이트
        return this.fromElkGraph(laidOut, graph);
    }

    private toElkGraph(graph: NodeGraph) {
        return {
            id: 'root',
            layoutOptions: {
                'elk.algorithm': 'layered',
                'elk.direction': 'RIGHT',
                'elk.spacing.nodeNode': '50',
                'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            },
            children: graph.nodes.map(node => ({
                id: node.id,
                width: node.size.width,
                height: node.size.height,
            })),
            edges: graph.connections.map(conn => ({
                id: `${conn.from_node}_${conn.to_node}`,
                sources: [conn.from_node],
                targets: [conn.to_node],
            })),
        };
    }
}
```

### 5.2 수동 조정

**드래그 앤 드롭:**
```typescript
class NodeDragHandler {
    onDragStart(node: VisualNode, event: PointerEvent) {
        this.draggedNode = node;
        this.dragOffset = {
            x: event.clientX - node.position.x,
            y: event.clientY - node.position.y,
        };
    }

    onDragMove(event: PointerEvent) {
        if (!this.draggedNode) return;

        this.draggedNode.position = {
            x: event.clientX - this.dragOffset.x,
            y: event.clientY - this.dragOffset.y,
        };

        // 스냅핑 (그리드에 정렬)
        if (this.snapToGrid) {
            this.draggedNode.position.x = Math.round(this.draggedNode.position.x / 20) * 20;
            this.draggedNode.position.y = Math.round(this.draggedNode.position.y / 20) * 20;
        }

        // 연결선 업데이트
        this.updateConnections(this.draggedNode);
    }
}
```

---

## 6. PixiJS 렌더링

### 6.1 노드 렌더링

```typescript
class NodeRenderer {
    private app: PIXI.Application;
    private container: PIXI.Container;

    renderNode(node: VisualNode): PIXI.Container {
        const nodeContainer = new PIXI.Container();
        nodeContainer.x = node.position.x;
        nodeContainer.y = node.position.y;

        // 배경
        const bg = new PIXI.Graphics();
        bg.beginFill(this.parseColor(node.color));
        bg.drawRoundedRect(0, 0, node.size.width, node.size.height, 8);
        bg.endFill();

        // 테두리
        bg.lineStyle(2, 0x000000, 0.2);
        bg.drawRoundedRect(0, 0, node.size.width, node.size.height, 8);

        nodeContainer.addChild(bg);

        // 제목
        const title = new PIXI.Text(node.label, {
            fontSize: 14,
            fontWeight: 'bold',
            fill: 0xffffff,
        });
        title.x = 10;
        title.y = 10;
        nodeContainer.addChild(title);

        // 포트
        this.renderPorts(node, nodeContainer);

        // 인터랙션
        nodeContainer.interactive = true;
        nodeContainer.on('pointerdown', (e) => this.onNodeDragStart(node, e));

        return nodeContainer;
    }

    renderPorts(node: VisualNode, container: PIXI.Container) {
        const portSize = 10;
        const portSpacing = 30;

        // 입력 포트 (왼쪽)
        node.inputs.forEach((port, i) => {
            const portGraphics = new PIXI.Graphics();
            portGraphics.beginFill(this.getTypeColor(port.type));
            portGraphics.drawCircle(0, 40 + i * portSpacing, portSize / 2);
            portGraphics.endFill();

            portGraphics.interactive = true;
            portGraphics.on('pointerdown', (e) => this.onPortClick(node, port, e));

            container.addChild(portGraphics);

            // 레이블
            const label = new PIXI.Text(port.label, { fontSize: 10, fill: 0xcccccc });
            label.x = portSize + 5;
            label.y = 40 + i * portSpacing - 5;
            container.addChild(label);
        });

        // 출력 포트 (오른쪽)
        node.outputs.forEach((port, i) => {
            const portGraphics = new PIXI.Graphics();
            portGraphics.beginFill(this.getTypeColor(port.type));
            portGraphics.drawCircle(node.size.width, 40 + i * portSpacing, portSize / 2);
            portGraphics.endFill();

            portGraphics.interactive = true;
            portGraphics.on('pointerdown', (e) => this.onPortClick(node, port, e));

            container.addChild(portGraphics);

            // 레이블 (오른쪽 정렬)
            const label = new PIXI.Text(port.label, { fontSize: 10, fill: 0xcccccc });
            label.anchor.set(1, 0);
            label.x = node.size.width - portSize - 5;
            label.y = 40 + i * portSpacing - 5;
            container.addChild(label);
        });
    }
}
```

### 6.2 연결선 렌더링

```typescript
class ConnectionRenderer {
    renderConnection(conn: Connection, fromNode: VisualNode, toNode: VisualNode): PIXI.Graphics {
        const line = new PIXI.Graphics();

        // 시작점과 끝점
        const fromPort = this.getPortPosition(fromNode, conn.from_port, true);
        const toPort = this.getPortPosition(toNode, conn.to_port, false);

        // 베지어 곡선
        line.lineStyle(conn.width || 2, this.parseColor(conn.color), 1);
        line.moveTo(fromPort.x, fromPort.y);

        const controlPoint1 = {
            x: fromPort.x + 50,
            y: fromPort.y,
        };
        const controlPoint2 = {
            x: toPort.x - 50,
            y: toPort.y,
        };

        line.bezierCurveTo(
            controlPoint1.x, controlPoint1.y,
            controlPoint2.x, controlPoint2.y,
            toPort.x, toPort.y
        );

        // 호버 시 하이라이트
        line.interactive = true;
        line.hitArea = this.createHitArea(fromPort, toPort);
        line.on('pointerover', () => {
            line.tint = 0xffff00;
        });
        line.on('pointerout', () => {
            line.tint = 0xffffff;
        });

        return line;
    }
}
```

---

## 7. 사용자 편의성

### 7.1 노드 팔레트

**새 노드 추가:**
```
┌────────────────────────────┐
│ Node Palette          [X]  │
├────────────────────────────┤
│ Search: [____________]     │
├────────────────────────────┤
│ 📊 Data                    │
│   - Variable               │
│   - Constant               │
│                            │
│ ⚙️  Operations             │
│   - Function Call          │
│   - Operator (+, -, *, /) │
│                            │
│ 🔀 Control Flow            │
│   - If/Else                │
│   - Switch                 │
│   - Loop                   │
└────────────────────────────┘
```

**드래그 앤 드롭:**
```typescript
class NodePalette {
    onDragStart(nodeType: NodeType, event: DragEvent) {
        event.dataTransfer.setData('nodeType', nodeType);
    }

    onCanvasDrop(event: DragEvent) {
        const nodeType = event.dataTransfer.getData('nodeType');
        const position = this.getCanvasPosition(event);

        // 새 노드 생성
        this.createNode(nodeType, position);
    }
}
```

### 7.2 미니맵

**전체 그래프 미리보기:**
```typescript
class Minimap {
    render(graph: NodeGraph, viewport: Viewport) {
        const scale = 0.1; // 10% 크기

        // 모든 노드를 작게 렌더링
        for (const node of graph.nodes) {
            this.graphics.beginFill(0x444444);
            this.graphics.drawRect(
                node.position.x * scale,
                node.position.y * scale,
                node.size.width * scale,
                node.size.height * scale
            );
        }

        // 현재 뷰포트 표시
        this.graphics.lineStyle(2, 0xffff00);
        this.graphics.drawRect(
            viewport.x * scale,
            viewport.y * scale,
            viewport.width * scale,
            viewport.height * scale
        );
    }
}
```

---

## 8. 최적화

### 8.1 가상화 (Viewport Culling)

```typescript
class ViewportCuller {
    getVisibleNodes(graph: NodeGraph, viewport: Viewport): VisualNode[] {
        return graph.nodes.filter(node => {
            const nodeRect = {
                x: node.position.x,
                y: node.position.y,
                width: node.size.width,
                height: node.size.height,
            };

            return this.intersects(nodeRect, viewport);
        });
    }

    render() {
        // 보이는 노드만 렌더링
        const visibleNodes = this.getVisibleNodes(this.graph, this.viewport);

        for (const node of visibleNodes) {
            this.renderNode(node);
        }
    }
}
```

### 8.2 LOD (Level of Detail)

```typescript
class LODManager {
    render(node: VisualNode, zoom: number) {
        if (zoom < 0.5) {
            // 간단한 버전 (작은 사각형만)
            this.renderSimplified(node);
        } else if (zoom < 1.0) {
            // 중간 버전 (제목 + 포트)
            this.renderMedium(node);
        } else {
            // 전체 버전
            this.renderFull(node);
        }
    }
}
```

---

## 9. 구현 로드맵

### Phase 1: 기본 노드 시스템 (Week 1-2)
- [ ] VisualNode 구조
- [ ] NodeGraph
- [ ] 기본 노드 타입 (Variable, FunctionCall, If)

### Phase 2: Code → Visual (Week 2-4)
- [ ] AST 분석 (Tree-sitter)
- [ ] 노드 생성
- [ ] 데이터 흐름 분석
- [ ] 레이아웃 알고리즘

### Phase 3: Visual → Code (Week 4-5)
- [ ] 코드 생성
- [ ] 실시간 동기화

### Phase 4: PixiJS 렌더링 (Week 5-7)
- [ ] 노드 렌더링
- [ ] 연결선 렌더링
- [ ] 인터랙션 (드래그, 클릭)

### Phase 5: UX (Week 7-8)
- [ ] 노드 팔레트
- [ ] 미니맵
- [ ] 줌/팬

### Phase 6: 최적화 (Week 8-10)
- [ ] 뷰포트 클리핑
- [ ] LOD
- [ ] 성능 프로파일링

---

## 10. 성능 타겟

> 상세: [review/document-review.md](../review/document-review.md)

| 작업 | 목표 시간 | 비고 |
|------|----------|------|
| Code → Visual 변환 | < 200ms | 초기 변환 |
| Visual → Code 동기화 | < 100ms | 노드 변경 시 |
| 노드 렌더링 (100개) | < 16ms | 60fps |
| 노드 드래그 | < 8ms | 즉각 반응 |
| 레이아웃 계산 | < 500ms | ELK 알고리즘 |
| 줌/팬 | < 16ms | 부드러운 동작 |

---

## 11. 관련 문서

### 아키텍처
- [editor-engine.md](../architecture/editor-engine.md) - AST 엔진
- [view-mode-system.md](../architecture/view-mode-system.md) - 뷰 모드 전환
- [ipc-protocol.md](../architecture/ipc-protocol.md) - IPC 최적화

### 기능 스펙
- [navigation.md](./navigation.md) - Navigation 기능
- [additional-features.md](./additional-features.md) - Code/View Mode

### 기술 문서
- [frontend-optimization.md](../technical/frontend-optimization.md) - PixiJS 최적화
- [plugin-system.md](../technical/plugin-system.md) - 커스텀 노드 타입 확장

---

## 참고 자료

- [Unreal Engine Blueprints](https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/)
- [Node-RED](https://nodered.org/)
- [PixiJS Documentation](https://pixijs.com/)
- [ELK (Eclipse Layout Kernel)](https://www.eclipse.org/elk/)

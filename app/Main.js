/*
  Copyright 2017 Esri

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.​
*/

define([
  "calcite",
  "dojo/_base/declare",
  "ApplicationBase/ApplicationBase",
  "dojo/i18n!./nls/resources",
  "ApplicationBase/support/itemUtils",
  "ApplicationBase/support/domHelper",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/on",
  "dojo/query",
  "dojo/mouse",
  "dojo/dom",
  "dojo/dom-class",
  "dojo/dom-style",
  "dojo/dom-construct",
  "esri/identity/IdentityManager",
  "esri/core/Evented",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
  "esri/layers/Layer",
  "esri/layers/GraphicsLayer",
  "esri/layers/FeatureLayer",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/geometry/Polygon",
  "esri/geometry/geometryEngine",
  "esri/geometry/Extent",
  "esri/geometry/Mesh",
  "esri/geometry/support/meshUtils",
  "esri/widgets/Feature",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand"
], function (calcite, declare, ApplicationBase, i18n, itemUtils, domHelper,
             Color, colors, number, on, query, mouse, dom, domClass, domStyle, domConstruct,
             IdentityManager, Evented, watchUtils, promiseUtils, Portal, Layer, GraphicsLayer, FeatureLayer,
             Graphic, Point, Polyline, Polygon, geometryEngine, Extent, Mesh, meshUtils,
             Feature, Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand) {

  return declare([Evented], {

    /**
     *
     */
    constructor: function () {
      this.CSS = {
        loading: "configurable-application--loading",
        NOTIFICATION_TYPE: {
          MESSAGE: "alert alert-blue animate-in-up is-active inline-block",
          SUCCESS: "alert alert-green animate-in-up is-active inline-block",
          WARNING: "alert alert-yellow animate-in-up is-active inline-block",
          ERROR: "alert alert-red animate-in-up is-active inline-block"
        },
      };
      this.base = null;
      calcite.init();
    },

    /**
     *
     * @param base
     */
    init: function (base) {
      if(!base) {
        console.error("ApplicationBase is not defined");
        return;
      }
      domHelper.setPageLocale(base.locale);
      domHelper.setPageDirection(base.direction);

      this.base = base;
      const config = base.config;
      const results = base.results;
      const find = config.find;
      const marker = config.marker;

      const allMapAndSceneItems = results.webMapItems.concat(results.webSceneItems);
      const validMapItems = allMapAndSceneItems.map(function (response) {
        return response.value;
      });

      const firstItem = validMapItems[0];
      if(!firstItem) {
        console.error("Could not load an item to display");
        return;
      }
      config.title = (config.title || itemUtils.getItemTitle(firstItem));
      domHelper.setPageTitle(config.title);

      const viewProperties = itemUtils.getConfigViewProperties(config);
      viewProperties.container = "view-container";

      const portalItem = this.base.results.applicationItem.value;
      const appProxies = (portalItem && portalItem.appProxies) ? portalItem.appProxies : null;

      itemUtils.createMapFromItem({ item: firstItem, appProxies: appProxies }).then((map) => {
        viewProperties.map = map;
        itemUtils.createView(viewProperties).then((view) => {
          itemUtils.findQuery(find, view).then(() => {
            itemUtils.goToMarker(marker, view).then(() => {
              domClass.remove(document.body, this.CSS.loading);
              this.viewReady(config, firstItem, view);
            });
          });
        });
      });
    },

    /**
     *
     * @param config
     * @param item
     * @param view
     */
    viewReady: function (config, item, view) {

      // TITLE //
      dom.byId("app-title-node").innerHTML = config.title;

      // MAP DETAILS //
      this.displayMapDetails(item);

      // LOADING //
      const updating_node = domConstruct.create("div", { className: "view-loading-node loader" });
      domConstruct.create("div", { className: "loader-bars" }, updating_node);
      domConstruct.create("div", { className: "loader-text font-size--3 text-white", innerHTML: "Updating..." }, updating_node);
      view.ui.add(updating_node, "bottom-right");
      watchUtils.init(view, "updating", (updating) => {
        domClass.toggle(updating_node, "is-active", updating);
      });

      // PANEL TOGGLE //
      if(query(".pane-toggle-target").length > 0) {
        const panelToggleBtn = domConstruct.create("div", { className: "panel-toggle icon-ui-left-triangle-arrow icon-ui-flush font-size-1", title: "Toggle Left Panel" }, view.root);
        on(panelToggleBtn, "click", () => {
          domClass.toggle(panelToggleBtn, "icon-ui-left-triangle-arrow icon-ui-right-triangle-arrow");
          query(".pane-toggle-target").toggleClass("hide");
          query(".pane-toggle-source").toggleClass("column-18 column-24");
        });
      }

      // USER SIGN IN //
      this.initializeUserSignIn(view).always(() => {

        // POPUP DOCKING OPTIONS //
        view.popup.dockEnabled = true;
        view.popup.dockOptions = {
          buttonEnabled: false,
          breakpoint: false,
          position: "top-right"
        };

        // SEARCH //
        /*const search = new Search({ view: view, searchTerm: this.base.config.search || "" });
        view.ui.add(search, { position: "top-left", index: 0 });*/

        // HOME //
        const home = new Home({ view: view });
        view.ui.add(home, { position: "top-left", index: 0 });

        // BASEMAPS //
        /*const basemapGalleryExpand = new Expand({
          view: view,
          content: new BasemapGallery({ view: view }),
          expandIconClass: "esri-icon-basemap",
          expandTooltip: "Basemap"
        });
        view.ui.add(basemapGalleryExpand, { position: "top-left", index: 4 });*/

        // MAP VIEW ONLY //
        if(view.type === "2d") {
          // SNAP TO ZOOM //
          view.constraints.snapToZoom = false;

          // COMPASS //
          const compass = new Compass({ view: view });
          view.ui.add(compass, { position: "top-left", index: 5 });

          // PRINT //
          const print = new Print({
            view: view,
            printServiceUrl: (config.helperServices.printTask.url || this.base.portal.helperServices.printTask.url),
            templateOptions: { title: config.title, author: this.base.portal.user ? this.base.portal.user.fullName : "" }
          }, "print-node");
          this.updatePrintOptions = (title, author, copyright) => {
            print.templateOptions.title = title || print.templateOptions.title;
            print.templateOptions.author = author || print.templateOptions.author;
            print.templateOptions.copyright = copyright || print.templateOptions.copyright;
          };
          this.on("portal-user-change", () => {
            this.updatePrintOptions(config.title, this.base.portal.user ? this.base.portal.user.fullName : "");
          });
        } else {
          domClass.add("print-action-node", "hide");
        }

        // SUBSURFACE TOOLS //
        this.initializeSubsurfaceTools(view);

      });

    },

    /**
     * DISPLAY MAP DETAILS
     *
     * @param portalItem
     */
    displayMapDetails: function (portalItem) {

      const itemLastModifiedDate = (new Date(portalItem.modified)).toLocaleString();

      dom.byId("current-map-card-thumb").src = portalItem.thumbnailUrl;
      dom.byId("current-map-card-thumb").alt = portalItem.title;
      dom.byId("current-map-card-caption").innerHTML = `A map by ${portalItem.owner}`;
      dom.byId("current-map-card-caption").title = "Last modified on " + itemLastModifiedDate;
      dom.byId("current-map-card-title").innerHTML = portalItem.title;
      dom.byId("current-map-card-title").href = `https://www.arcgis.com/home/item.html?id=${portalItem.id}`;
      dom.byId("current-map-card-description").innerHTML = portalItem.description;

    },

    /**
     *
     * @returns {*}
     */
    initializeUserSignIn: function (view) {

      const checkSignInStatus = () => {
        return IdentityManager.checkSignInStatus(this.base.portal.url).then(userSignIn);
      };
      IdentityManager.on("credential-create", checkSignInStatus);
      IdentityManager.on("credential-destroy", checkSignInStatus);

      // SIGN IN NODE //
      const signInNode = dom.byId("sign-in-node");
      const userNode = dom.byId("user-node");

      // UPDATE UI //
      const updateSignInUI = () => {
        if(this.base.portal.user) {
          dom.byId("user-firstname-node").innerHTML = this.base.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.base.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.base.portal.user.username;
          dom.byId("user-thumb-node").src = this.base.portal.user.thumbnailUrl;
          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");
        } else {
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");
        }
        return promiseUtils.resolve();
      };

      // SIGN IN //
      const userSignIn = () => {
        this.base.portal = new Portal({ url: this.base.config.portalUrl, authMode: "immediate" });
        return this.base.portal.load().then(() => {
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);
      };

      // SIGN OUT //
      const userSignOut = () => {
        IdentityManager.destroyCredentials();
        this.base.portal = new Portal({});
        this.base.portal.load().then(() => {
          this.base.portal.user = null;
          this.emit("portal-user-change", {});
          return updateSignInUI();
        }).otherwise(console.warn);

      };

      // USER SIGN IN //
      on(signInNode, "click", userSignIn);

      // SIGN OUT NODE //
      const signOutNode = dom.byId("sign-out-node");
      if(signOutNode) {
        on(signOutNode, "click", userSignOut);
      }

      return checkSignInStatus();
    },

    /**
     *
     * @param layer
     * @param error
     */
    addLayerNotification: function (layer, error) {
      const notificationsNode = dom.byId("notifications-node");

      const alertNode = domConstruct.create("div", {
        className: error ? this.CSS.NOTIFICATION_TYPE.ERROR : this.CSS.NOTIFICATION_TYPE.SUCCESS
      }, notificationsNode);

      const alertCloseNode = domConstruct.create("div", { className: "inline-block esri-interactive icon-ui-close margin-left-1 right" }, alertNode);
      on.once(alertCloseNode, "click", () => {
        domConstruct.destroy(alertNode);
      });

      domConstruct.create("div", { innerHTML: error ? error.message : `Layer '${layer.title}' added to map...` }, alertNode);

      if(error) {
        if(layer.portalItem) {
          const itemDetailsPageUrl = `${this.base.portal.url}/home/item.html?id=${layer.portalItem.id}`;
          domConstruct.create("a", { innerHTML: "view item details", target: "_blank", href: itemDetailsPageUrl }, alertNode);
        }
      } else {
        setTimeout(() => {
          domClass.toggle(alertNode, "animate-in-up animate-out-up");
          setTimeout(() => {
            domConstruct.destroy(alertNode);
          }, 500)
        }, 4000);
      }
    },

    /**
     *
     * @param view
     * @param layer_title
     * @returns {*}
     */
    whenLayerReady: function (view, layer_title) {

      const layer = view.map.layers.find(layer => {
        return (layer.title === layer_title);
      });
      if(layer) {
        return layer.load().then(() => {
          // TODO: WHAT IF LAYER IS NOT VISIBLE? //
          return view.whenLayerView(layer).then((layerView) => {
            return watchUtils.whenFalseOnce(layerView, "updating").then(() => {
              return { layer: layer, layerView: layerView };
            });
          });
        });
      } else {
        return promiseUtils.reject(new Error(`Can't find layer '${layer_title}'`));
      }

    },

    /**
     *
     * @param view
     */
    initializeZoomWindow: function (view) {

      // ZOOM WINDOW ENABLED //
      let zoom_window_enabled = false;

      // ZOOM WINDOW BUTTON //
      const zoom_window_btn = domConstruct.create("div", { className: "esri-widget--button icon-ui-zoom-in-magnifying-glass icon-ui-flush", title: "Zoom Window" });
      view.ui.add(zoom_window_btn, { position: "top-right", index: 1 });
      on(zoom_window_btn, "click", () => {
        domClass.toggle(zoom_window_btn, "selected");
        zoom_window_enabled = domClass.contains(zoom_window_btn, "selected");
        view.container.style.cursor = zoom_window_enabled ? "all-scroll" : "default";
      });

      // VIEW TYPE HAS CHANGED //
      this.on("view-type-change", () => {
        domClass.remove(zoom_window_btn, "icon-ui-blue");
        zoom_window_enabled = false;
      });

      // CALC WINDOW POSITION //
      const window_offset = 12;
      const zoom_window_position = (pos_evt) => {
        const top_offset = (pos_evt.y < (view.height - 200)) ? window_offset : -150 - window_offset;
        const left_offset = (pos_evt.x < (view.width - 200)) ? window_offset : -150 - window_offset;
        return {
          top: (pos_evt.y + top_offset) + "px",
          left: (pos_evt.x + left_offset) + "px"
        };
      };

      // CONTAINER //
      const zoom_container = domConstruct.create("div", { className: "zoom-view-node panel panel-dark-blue hide" }, view.root, "first");
      const display_zoom_window = (position_evt) => {
        domConstruct.place(zoom_container, view.root, position_evt ? "last" : "first");
        domClass.toggle(zoom_container, "hide", !position_evt);
        if(position_evt) {
          domStyle.set(zoom_container, zoom_window_position(position_evt));
        }
      };

      // MAP VIEW //
      const zoom_view = new MapView({
        container: zoom_container,
        ui: { components: [] },
        map: view.map
      });

      // IS WITHIN VIEW //
      const is_within_view = (evt) => {
        return (evt.x > 0) && (evt.x < view.width) && (evt.y > 0) && (evt.y < view.height);
      };

      // ZOOM LEVEL OFFSET //
      const zoom_level_offset = 3;
      // LAST EVENT //
      let last_evt = null;

      // UPDATE ZOOM WINDOW //
      const update_zoom_window = (view_evt) => {
        if(is_within_view(view_evt)) {
          const map_point = view.toMap(view_evt);
          if(map_point) {
            last_evt = view_evt;

            // DISPLAY ZOOM WINDOW //
            display_zoom_window(view_evt);

            // GOTO //
            zoom_view.goTo({
              target: map_point,
              zoom: (view.zoom + zoom_level_offset)
            }, { animate: false });

          } else {
            // IN 3D IF NOT ON GLOBE //
            display_zoom_window();
            last_evt = null;
          }
        } else {
          // NOT WITHIN VIEW //
          display_zoom_window();
          last_evt = null;
        }
      };

      // POINTER DOWN //
      view.on("pointer-down", (pointer_down_evt) => {
        if(zoom_window_enabled) {
          pointer_down_evt.stopPropagation();
          if(pointer_down_evt.button === 0) {
            update_zoom_window(pointer_down_evt);
          }
        }
      });

      // DRAG //
      view.on("drag", (drag_evt) => {
        if(zoom_window_enabled) {
          drag_evt.stopPropagation();
          switch (drag_evt.action) {
            case "update":
              update_zoom_window(drag_evt);
              break;
            default:
              last_evt = null;
          }
        }
      });

      // VIEWPOINT WILL CHANGE IF 3D VIEW IS SPINNING //
      if(view.type === "3d") {
        view.watch("viewpoint", () => {
          if(zoom_window_enabled && last_evt) {
            update_zoom_window(last_evt, view.toMap(last_evt));
          }
        });
      }

      // POINTER UP //
      view.on("pointer-up", () => {
        if(zoom_window_enabled) {
          display_zoom_window();
          last_evt = null;
        }
      });
      // POINTER LEAVE //
      view.on("pointer-leave", () => {
        if(zoom_window_enabled) {
          display_zoom_window();
          last_evt = null;
        }
      });

    },


    /**
     *
     * @param view
     */
    initializeSubsurfaceTools: function (view) {

      view.constraints = {
        collision: { enabled: false },
        tilt: { max: 179.99 }
      };

      this.anchorSymbol = {
        type: "point-3d",
        symbolLayers: [
          {
            type: "object",
            anchor: "center",
            width: 50,
            height: 1,
            tilt: 0,
            roll: 0,
            resource: { primitive: "cylinder" },
            material: { color: Color.named.yellow.concat(0.5) }
          },
          {
            type: "object",
            anchor: "bottom",
            width: 10,
            height: 150,
            tilt: 0,
            roll: 0,
            resource: { primitive: "cylinder" },
            material: { color: Color.named.green.concat(0.9) }
          },
          {
            type: "object",
            anchor: "bottom",
            width: 10,
            height: 150,
            tilt: 45,
            roll: 90,
            resource: { primitive: "cylinder" },
            material: { color: Color.named.blue.concat(0.9) }
          },
          {
            type: "object",
            anchor: "bottom",
            width: 10,
            height: 150,
            tilt: 90,
            roll: 180,
            resource: { primitive: "cylinder" },
            material: { color: Color.named.red.concat(0.9) }
          }
        ]
      };

      this.getHitResult = (viewEvt) => {
        return view.hitTest(viewEvt).then((hitResponse) => {
          const dataResults = hitResponse.results.filter((result) => {
            return (result.graphic && result.graphic.layer);
          });
          if(dataResults.length > 0) {
            const firstResult = dataResults[0];
            if(firstResult.graphic.geometry.type === "point") {
              return firstResult.graphic.geometry;
            } else {
              return firstResult.mapPoint;
            }
          } else {
            return null;
          }
          //view.toMap(hitResponse.screenPoint);
        });
      };

      this.disableOtherViewTools = (target) => {
        query(".view-tool").forEach((node) => {
          if((node !== target) && (domClass.contains(node, "icon-ui-check-mark"))) {
            node.click();
          }
        });
      };

      this.initializeSelectableData(view).then(() => {
        //this.initializeElevationSlider(view);
        this.initializeUndergroundDisplay(view);
        this.initializeDragZoom(view);
        this.initializeSelectionTools(view);
        this.initializeMeasureTool(view);
      });

    },

    /**
     *
     * @param view
     */
    initializeElevationSlider: function (view) {

      const elevationSlider = domConstruct.create("input", { className: "elevation-slider", type: "range" });
      view.ui.add(elevationSlider, "bottom-right");

      const inputHandle = on.pausable(elevationSlider, "input", () => {
        const camera = view.camera.clone();
        camera.position.z = (currentZ + elevationSlider.valueAsNumber);
        view.camera = camera;
      });
      inputHandle.pause();

      let currentZ = view.camera.position.z;
      on(elevationSlider, mouse.enter, () => {
        currentZ = view.camera.position.z;
        //const limit = Math.min(view.dataExtent.width, view.dataExtent.height) * 0.5;
        const limit = Math.abs(view.viewpoint.targetGeometry.z);
        elevationSlider.min = -limit;
        elevationSlider.max = limit;
        elevationSlider.step = (limit / 100);
        inputHandle.resume();
      });
      on(elevationSlider, mouse.leave, () => {
        inputHandle.pause();
        elevationSlider.valueAsNumber = 0;
      });


    },

    /**
     *
     * @param view
     */
    initializeUndergroundDisplay: function (view) {

      // HIDE BASEMAP //
      /*const adjustDefaultBasemap = (opacity) => {
       view.map.basemap.baseLayers.concat(view.map.basemap.referenceLayers).forEach((basemapLayer) => {
       basemapLayer.opacity = opacity
       });
       };
       let isBasemapVisible = true;
       const hideBasemapBtn = dom.byId("hide-basemap-btn");
       on(hideBasemapBtn, "click", () => {
       isBasemapVisible = (!isBasemapVisible);
       adjustDefaultBasemap(isBasemapVisible ? 1.0 : 0.0);
       });*/


      // SEE THROUGH GROUND //
      const seeThroughBtn = dom.byId("see-through-btn");
      on(seeThroughBtn, "click", () => {
        domClass.toggle(seeThroughBtn, "btn-clear icon-ui-check-mark");
        if(domClass.contains(seeThroughBtn, "icon-ui-check-mark")) {
          view.map.ground.opacity = 0.2;
          /*
          view.basemapTerrain.wireframe = {
            mode: "shader",
            wireOpacity: 1.0,
            surfaceOpacity: 0.0,
            width: 1,
            subdivision: "constant",
            subdivisionReduceLevels: 2
          };
          view.basemapTerrain.frontMostTransparent = true;
          */
        } else {
          view.map.ground.opacity = 1.0;
          // view.basemapTerrain.wireframe = false;
          // view.basemapTerrain.frontMostTransparent = false;
        }
      });
      domClass.remove(seeThroughBtn, "btn-disabled");

      this.initializeClippingArea(view);

    },

    /**
     *
     * @param view
     */
    initializeClippingArea: function (view) {


      let clippingAreaGraphic = new Graphic({
        symbol: {
          type: "line-3d",
          symbolLayers: [{
            type: "path",
            size: 25,
            material: { color: Color.named.dodgerblue }
          }]
          /*
          type: "polygon-3d",
          symbolLayers: [{
              type: "fill",
              material: { color: Color.named.dodgerblue.concat(0.5) }
          }]
          */
        }
      });
      const clippingExtentLayer = new GraphicsLayer({ graphics: [clippingAreaGraphic] });
      view.map.add(clippingExtentLayer);

      const displayClippingArea = (extent) => {
        clippingExtentLayer.graphics.remove(clippingAreaGraphic);
        clippingAreaGraphic = clippingAreaGraphic.clone();
        clippingAreaGraphic.geometry = extent ? this.createClippingArea(view, extent) : null;
        clippingExtentLayer.graphics.add(clippingAreaGraphic);
      };

      // CLIP EXTENT //
      const clipExtentBtn = dom.byId("clip-extent-btn");
      on(clipExtentBtn, "click", () => {
        domClass.toggle(clipExtentBtn, "btn-clear icon-ui-check-mark");

        const view_extent = view.extent.clone().expand(0.8);

        //const view_extent_z = view.groundView.elevationSampler.queryElevation(Polygon.fromExtent(view_extent));
        //console.info(view_extent_z);

        view.clippingArea = domClass.contains(clipExtentBtn, "icon-ui-check-mark") ? view_extent : null;
        displayClippingArea(view.clippingArea);

      });
      domClass.remove(clipExtentBtn, "btn-disabled");

    },

    /**
     *
     * @param view
     * @param extent
     */
    createClippingArea: function (view, extent) {
      //console.info(view);

      const extent_ring = Polygon.fromExtent(view.dataExtent).rings[0];
      const top_path = this.setPathZs(extent_ring, 500); //view.dataExtent.zmax);
      const bottom_path = this.setPathZs(extent_ring, view.dataExtent.zmin);

      const extent_as_polyline_z = new Polyline({ spatialReference: extent.spatialReference, hasZ: true });
      extent_as_polyline_z.addPath(top_path);
      extent_as_polyline_z.addPath([top_path[0], bottom_path[0]]);
      extent_as_polyline_z.addPath([top_path[1], bottom_path[1]]);
      extent_as_polyline_z.addPath([top_path[2], bottom_path[2]]);
      extent_as_polyline_z.addPath([top_path[3], bottom_path[3]]);
      extent_as_polyline_z.addPath(bottom_path);

      /*const extent_as_polyline_z = new Polygon({ spatialReference: extent.spatialReference, hasZ: true });
      extent_as_polyline_z.addRing(top_path);
      extent_as_polyline_z.addRing([top_path[0], bottom_path[0], bottom_path[1], top_path[1], top_path[0]]);
      extent_as_polyline_z.addRing([top_path[1], bottom_path[1], bottom_path[2], top_path[2], top_path[1]]);
      extent_as_polyline_z.addRing([top_path[2], bottom_path[2], bottom_path[3], top_path[3], top_path[2]]);
      extent_as_polyline_z.addRing([top_path[3], bottom_path[3], bottom_path[0], top_path[0], top_path[3]]);
      extent_as_polyline_z.addRing(bottom_path);*/

      return extent_as_polyline_z;
    },

    /**
     *
     * @param path
     * @param path_z
     */
    setPathZs: function (path, path_z) {
      return path.map(coords => {
        return [coords[0], coords[1], path_z];
      });
    },

    /**
     *
     * @param view
     */
    initializeDragZoom: function (view) {

      let pullStart = null;
      let pullEnd = null;

      const pointerMoveHandle = on.pausable(view, "pointer-move", (pointerMoveEvt) => {
        pointerMoveEvt.stopPropagation();
        this.getHitResult(pointerMoveEvt).then((mapPoint) => {
          if(mapPoint) {
            domStyle.set(view.container, "cursor", "crosshair");
          } else {
            domStyle.set(view.container, "cursor", "default");
          }
        });
      });
      pointerMoveHandle.pause();

      const pointerDownHandle = on.pausable(view, "pointer-down", (pointerDownEvt) => {
        pointerDownEvt.stopPropagation();
        this.getHitResult(pointerDownEvt).then((mapPoint) => {
          if(mapPoint) {
            pullStart = mapPoint;
            pullEnd = view.camera.position;
          } else {
            pullStart = null;
            pullEnd = null;
          }
        });
      });
      pointerDownHandle.pause();

      const dragHandle = on.pausable(view, "drag", (dragEvt) => {
        dragEvt.stopPropagation();
        switch (dragEvt.action) {
          case "start":
            pointerMoveHandle.pause();
            pointerDownHandle.pause();
            break;

          case "update":
            if(pullStart && pullEnd) {
              const along = this._distance2D(dragEvt.origin, dragEvt) / ((Math.max(view.width, view.height) * 0.5));
              const newPosition = this._interpolateLocation(view, pullEnd, pullStart, along);
              const camera = view.camera.clone();
              camera.position = newPosition;
              view.camera = camera;
            }
            break;

          case "end":
            pullStart = null;
            pullEnd = null;
            pointerMoveHandle.resume();
            pointerDownHandle.resume();
            break;
        }
      });
      dragHandle.pause();

      // PULL ZOOM //
      const pullZoomBtn = dom.byId("pull-zoom-btn");
      on(pullZoomBtn, "click", () => {
        domClass.toggle(pullZoomBtn, "btn-clear icon-ui-check-mark");
        if(domClass.contains(pullZoomBtn, "icon-ui-check-mark")) {
          dragHandle.resume();
          pointerMoveHandle.resume();
          pointerDownHandle.resume();
        } else {
          pullStart = null;
          pullEnd = null;
          dragHandle.pause();
          pointerMoveHandle.pause();
          pointerDownHandle.pause();
          domStyle.set(view.container, "cursor", "default");
        }
      });
      domClass.remove(pullZoomBtn, "btn-disabled");

    },

    /**
     *
     * @param view
     * @param fromPnt
     * @param toPnt
     * @param along
     * @returns {*}
     * @private
     */
    _interpolateLocation: function (view, fromPnt, toPnt, along) {
      return new Point({
        spatialReference: view.spatialReference,
        hasZ: true,
        x: fromPnt.x + ((toPnt.x - fromPnt.x) * along),
        y: fromPnt.y + ((toPnt.y - fromPnt.y) * along),
        z: fromPnt.z + ((toPnt.z - fromPnt.z) * along)
      });
    },

    /**
     *
     * @param view
     * @returns {Promise}
     */
    initializeSelectableData: function (view) {

      const seismicLayer = view.map.layers.find(layer => {
        return (layer.title === "Microseismic");
      });
      return seismicLayer.load().then(() => {

        //const defaultSymbol = seismicLayer.renderer.symbol.clone();

        seismicLayer.featureReduction = null;
        //seismicLayer.popupEnabled = false;
        /*seismicLayer.renderer = {
          type: "simple",
          // symbol: defaultSymbol,
          symbol: {
            type: "point-3d",
            symbolLayers: [
              {
                type: "object",
                anchor: "center",
                depth: 32,
                resource: { primitive: "sphere" },
                material: { color: Color.named.yellow }
              }
            ]
          },
          visualVariables: [
            {
              type: "color",
              field: "MAGNITUDE",
              stops: [
                { value: -2.0, color: Color.named.yellow },
                { value: -1.0, color: Color.named.red },
                { value: -0.5, color: Color.named.darkred }
              ]
            },
            {
              type: "size",
              field: "MAGNITUDE",
              axis: "all",
              stops: [
                { value: -2.0, size: 25 },
                { value: -1.0, size: 50 },
                { value: -0.5, size: 150 }
              ]
            }
          ]
        };*/

        let seismicFeatures = null;
        this.getSeismicFeatures = () => {
          return seismicFeatures;
        };

        this.updateSelectionUI = (hasFeatures) => {
          domClass.toggle("data-count", "label-blue", hasFeatures);
          domClass.toggle("data-count", "label-red", !hasFeatures);
          domClass.toggle("selection-btn", "btn-disabled", !hasFeatures);
        };

        const featureWithAttributesQuery = seismicLayer.createQuery();
        featureWithAttributesQuery.outFields = ["*"];
        featureWithAttributesQuery.returnZ = true;

        seismicLayer.queryFeatures(featureWithAttributesQuery).then((seismicFeatureSet) => {
          seismicFeatures = seismicFeatureSet.features;
          this.updateSelectionUI(seismicFeatures.length > 0);
          dom.byId("data-count").innerHTML = `0 of ${number.format(seismicFeatures.length)}`;

          view.whenLayerView(seismicLayer).then((seismicLayerView) => {

            let highlight;
            this.selectSeismicFeatures = (selectedFeatures) => {
              highlight && highlight.remove();
              domConstruct.empty("data-list");

              const hasFeatures = (selectedFeatures && (selectedFeatures.length > 0));
              if(hasFeatures) {
                highlight = seismicLayerView.highlight(selectedFeatures);

                selectedFeatures.forEach((selectedFeature) => {
                  const atts = selectedFeature.attributes;
                  const featureNode = domConstruct.create("div", {
                    className: "side-nav-link",
                    innerHTML: `[${atts.OBJECTID}] MAG:${atts.MAGNITUDE.toFixed(2)} AMP:${atts.Amp.toFixed(2)} SNR:${atts.SNR.toFixed(2)}`,
                    title: JSON.stringify(selectedFeature.attributes, null, "\t")
                  }, "data-list", "first");
                  //on(featureNode, "click", () => {});
                });
              }
              dom.byId("data-count").innerHTML = `${number.format(selectedFeatures.length)} of ${number.format(seismicFeatures.length)}`;
            };

          }).otherwise((error) => {
            domConstruct.create("div", { className: "side-nav-link icon-ui-error2 text-red", innerHTML: JSON.stringify(error) }, "data-list");
          });
        });
      });

    },

    /**
     *
     * @param view
     */
    initializeSelectionTools: function (view) {

      const selectionDistanceInput = dom.byId("selectionDistanceInput");

      const createSelectionGeometry = (location, size) => {

        //const sphere = Mesh.createSphere(location, { size: size * 2.0, densificationFactor: 3, material: { color: Color.named.purple.concat(0.1) } }).centerAt(location);
        /*const faces = ["east", "north", "up"].map(facing => {
          return Mesh.createPlane(location, { size: size * 1.34, facing: facing, material: { color: Color.named.white } }).centerAt(location);
        });
        return meshUtils.merge(faces.concat(sphere));*/

        return Mesh.createSphere(location, { size: size * 2.0, densificationFactor: 2 }).centerAt(location);
      };

      /*const createSelectionSymbol = (size) => {
        return {
          type: "point-3d",
          symbolLayers: this.anchorSymbol.symbolLayers.concat([
            {
              type: "object",
              anchor: "center",
              width: size * 2.0,
              height: size * 2.0,
              depth: size * 2.0,
              resource: { primitive: "sphere" },
              material: { color: Color.named.purple.concat(0.4) }
            }
          ])
        }
      };*/
      //let selectionGraphic = new Graphic({ symbol: createSelectionSymbol(selectionDistanceInput.valueAsNumber) });
      let selectionGraphic = new Graphic({
        symbol: {
          type: "mesh-3d",
          symbolLayers: [
            {
              type: "fill",
              material: { color: Color.named.purple.concat(0.15) },
              edges: {
                type: "solid",
                color: Color.named.purple,
                size: 1.0
              }
            }
          ]
        }
      });
      view.graphics.add(selectionGraphic);


      let selection_location = null;
      const updateSelectionLocation = (location) => {
        selection_location = location;
        view.graphics.remove(selectionGraphic);
        selectionGraphic = selectionGraphic.clone();
        selectionGraphic.geometry = (selection_location != null) ? createSelectionGeometry(selection_location, selectionDistanceInput.valueAsNumber) : null;
        view.graphics.add(selectionGraphic);
        selectNearbyData();
      };

      const updateSelectionDistance = (distance) => {
        view.graphics.remove(selectionGraphic);
        selectionGraphic = selectionGraphic.clone();
        selectionGraphic.geometry = (distance != null) ? createSelectionGeometry(selection_location, distance) : null;
        //selectionGraphic.symbol = (distance != null) ? createSelectionSymbol(distance) : selectionGraphic.symbol;
        view.graphics.add(selectionGraphic);
        selectNearbyData();
      };

      // USER UPDATES LOCATION OR DISTANCE //
      const pointerDownHandle = on.pausable(view, "pointer-down", (pointerDownEvt) => {
        pointerDownEvt.stopPropagation();
        this.getHitResult(pointerDownEvt).then((mapPoint) => {
          if(mapPoint) {
            updateSelectionLocation(mapPoint);
          }
        });
      });
      pointerDownHandle.pause();
      on(selectionDistanceInput, "input", () => {
        updateSelectionDistance(selectionDistanceInput.valueAsNumber);
      });

      // SELECTION TOOL //
      const selectionTool = dom.byId("selection-btn");
      on(selectionTool, "click", () => {
        domClass.toggle(selectionTool, "btn-clear icon-ui-check-mark");
        if(domClass.contains(selectionTool, "icon-ui-check-mark")) {
          this.disableOtherViewTools(selectionTool);
          domStyle.set(view.container, "cursor", "crosshair");
          selectableFeatures = this.getSeismicFeatures();
          pointerDownHandle.resume();
        } else {
          domStyle.set(view.container, "cursor", "default");
          updateSelectionLocation();
          pointerDownHandle.pause();
        }
      });

      // SELECT NEARBY DATA //
      let selectableFeatures = null;
      const selectNearbyData = () => {
        if(selectionGraphic.geometry && selectableFeatures) {
          const selectedFeatures = selectableFeatures.reduce((selectedFeatures, feature) => {
            const distance3D = this._distance3D(selectionGraphic.geometry.extent.center, feature.geometry);
            if(distance3D <= selectionDistanceInput.valueAsNumber) {
              selectedFeatures.push(feature);
            }
            return selectedFeatures;
          }, []);
          this.selectSeismicFeatures(selectedFeatures);
        } else {
          this.selectSeismicFeatures([]);
        }
      }

    },

    /**
     *
     * @param view
     */
    initializeMeasureTool: function (view) {

      const measureLineSymbol = {
        type: "line-3d",
        symbolLayers: [
          {
            type: "path",
            size: 12,
            material: { color: Color.named.cyan }
          }
        ]
      };
      const measureLine = new Polyline({
        spatialReference: view.spatialReference,
        paths: []
      });
      let measureGraphic = new Graphic({ geometry: measureLine, symbol: measureLineSymbol });
      view.graphics.add(measureGraphic);

      const updateMeasureGraphic = () => {
        view.graphics.remove(measureGraphic);
        measureGraphic = measureGraphic.clone();
        measureGraphic.geometry = measureLine.clone();
        view.graphics.add(measureGraphic);
      };

      let measureStart = null;
      let locationGraphic = new Graphic({ symbol: this.anchorSymbol });
      view.graphics.add(locationGraphic);
      const updateLocationGraphic = () => {
        view.graphics.remove(locationGraphic);
        locationGraphic = locationGraphic.clone();
        locationGraphic.geometry = measureStart ? measureStart.clone() : null;
        view.graphics.add(locationGraphic);
      };


      const pointerDownHandle = on.pausable(view, "pointer-move", (pointerDownEvt) => {
        pointerDownEvt.stopPropagation();
        this.getHitResult(pointerDownEvt).then((mapPoint) => {
          if(mapPoint) {
            measureStart = mapPoint.clone();
            updateLocationGraphic();
          }
        });
      });
      pointerDownHandle.pause();

      const dragHandle = on.pausable(view, "drag", (dragEvt) => {
        dragEvt.stopPropagation();
        switch (dragEvt.action) {
          case "start":
            pointerDownHandle.pause();
            if(measureStart) {
              measureLine.removePath(0);
              measureLine.addPath([measureStart.clone(), measureStart.clone()]);
              updateMeasureGraphic();
              //updateLocationGraphic();
            }
            break;

          case "update":
            this.getHitResult(dragEvt).then((mapPoint) => {
              if(mapPoint) {
                const distance3D = this._distance3D(measureStart, mapPoint);
                if(distance3D > 0.0) {
                  dom.byId("measureDistance").innerHTML = number.format(distance3D, { places: 2 });

                  measureLine.setPoint(0, 1, mapPoint.clone());
                  updateMeasureGraphic();
                }
              }
            });
            break;

          case "end":
            pointerDownHandle.resume();
            break;
        }
      });
      dragHandle.pause();


      // MEASURE TOOL //
      const measureTool = dom.byId("measure-btn");
      on(measureTool, "click", () => {
        domClass.toggle(measureTool, "btn-clear icon-ui-check-mark");
        if(domClass.contains(measureTool, "icon-ui-check-mark")) {
          this.disableOtherViewTools(measureTool);
          pointerDownHandle.resume();
          dragHandle.resume();
        } else {
          dragHandle.pause();
          pointerDownHandle.pause();
          measureStart = null;
          measureLine.removePath(0);
          updateMeasureGraphic();
          updateLocationGraphic();
          dom.byId("measureDistance").innerHTML = "0.00";
          domStyle.set(view.container, "cursor", "default");
        }
      });
      domClass.remove(measureTool, "btn-disabled");

    },

    /**
     *
     * @param fromPoint
     * @param toPoint
     * @returns {number}
     * @private
     */
    _distance2D: function (fromPoint, toPoint) {
      return Math.sqrt(Math.pow((fromPoint.x - toPoint.x), 2) + Math.pow((fromPoint.y - toPoint.y), 2));
    },

    /**
     *
     * @param fromPoint
     * @param toPoint
     * @returns {number}
     * @private
     */
    _distance3D: function (fromPoint, toPoint) {
      return Math.sqrt(Math.pow((fromPoint.x - toPoint.x), 2) + Math.pow((fromPoint.y - toPoint.y), 2) + Math.pow((fromPoint.z - toPoint.z), 2));
    }

  });
});
/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as React from 'react';
import { uniq } from 'lodash';
import { connect } from 'react-redux';
import { Helmet } from 'react-helmet';
import QualityGate from '../qualityGate/QualityGate';
import ApplicationQualityGate from '../qualityGate/ApplicationQualityGate';
import BugsAndVulnerabilities from '../main/BugsAndVulnerabilities';
import CodeSmells from '../main/CodeSmells';
import Coverage from '../main/Coverage';
import Duplications from '../main/Duplications';
import Meta from '../meta/Meta';
import throwGlobalError from '../../../app/utils/throwGlobalError';
import { getMeasuresAndMeta } from '../../../api/measures';
import { getAllTimeMachineData, History } from '../../../api/time-machine';
import { parseDate } from '../../../helpers/dates';
import { enhanceMeasuresWithMetrics, MeasureEnhanced } from '../../../helpers/measures';
import { getLeakPeriod, Period } from '../../../helpers/periods';
import { get } from '../../../helpers/storage';
import { METRICS, HISTORY_METRICS_LIST } from '../utils';
import {
  DEFAULT_GRAPH,
  getDisplayedHistoryMetrics,
  PROJECT_ACTIVITY_GRAPH,
  PROJECT_ACTIVITY_GRAPH_CUSTOM
} from '../../projectActivity/utils';
import { isSameBranchLike, getBranchLikeQuery } from '../../../helpers/branches';
import { fetchMetrics } from '../../../store/rootActions';
import { getMetrics } from '../../../store/rootReducer';
import { BranchLike, Component, Metric } from '../../../app/types';
import { translate } from '../../../helpers/l10n';
import { getPathUrlAsString, getProjectUrl } from '../../../helpers/urls';
import '../styles.css';

interface OwnProps {
  branchLike?: BranchLike;
  component: Component;
  onComponentChange: (changes: {}) => void;
}

interface StateToProps {
  metrics: { [key: string]: Metric };
}

interface DispatchToProps {
  fetchMetrics: () => void;
}

type Props = StateToProps & DispatchToProps & OwnProps;

interface State {
  history?: History;
  historyStartDate?: Date;
  loading: boolean;
  measures: MeasureEnhanced[];
  periods?: Period[];
}

export class OverviewApp extends React.PureComponent<Props, State> {
  mounted = false;
  state: State = { loading: true, measures: [] };

  componentDidMount() {
    this.mounted = true;
    this.props.fetchMetrics();
    this.loadMeasures().then(this.loadHistory, () => {});
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.component.key !== prevProps.component.key ||
      !isSameBranchLike(this.props.branchLike, prevProps.branchLike)
    ) {
      this.loadMeasures().then(this.loadHistory, () => {});
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  loadMeasures() {
    const { branchLike, component } = this.props;
    this.setState({ loading: true });

    return getMeasuresAndMeta(component.key, METRICS, {
      additionalFields: 'metrics,periods',
      ...getBranchLikeQuery(branchLike)
    }).then(
      r => {
        if (this.mounted && r.metrics) {
          this.setState({
            loading: false,
            measures: enhanceMeasuresWithMetrics(r.component.measures, r.metrics),
            periods: r.periods
          });
        }
      },
      error => {
        throwGlobalError(error);
        if (this.mounted) {
          this.setState({ loading: false });
        }
      }
    );
  }

  loadHistory = () => {
    const { branchLike, component } = this.props;

    const customGraphs = get(PROJECT_ACTIVITY_GRAPH_CUSTOM);
    let graphMetrics = getDisplayedHistoryMetrics(
      get(PROJECT_ACTIVITY_GRAPH) || 'issues',
      customGraphs ? customGraphs.split(',') : []
    );
    if (!graphMetrics || graphMetrics.length <= 0) {
      graphMetrics = getDisplayedHistoryMetrics(DEFAULT_GRAPH, []);
    }

    const metrics = uniq(HISTORY_METRICS_LIST.concat(graphMetrics));
    return getAllTimeMachineData({
      ...getBranchLikeQuery(branchLike),
      component: component.key,
      metrics: metrics.join()
    }).then(r => {
      if (this.mounted) {
        const history: History = {};
        r.measures.forEach(measure => {
          const measureHistory = measure.history.map(analysis => ({
            date: parseDate(analysis.date),
            value: analysis.value
          }));
          history[measure.metric] = measureHistory;
        });
        const historyStartDate = history[HISTORY_METRICS_LIST[0]][0].date;
        this.setState({ history, historyStartDate });
      }
    });
  };

  getApplicationLeakPeriod = () =>
    this.state.measures.find(measure => measure.metric.key === 'new_bugs')
      ? { index: 1 }
      : undefined;

  isEmpty = () =>
    this.state.measures === undefined ||
    this.state.measures.find(measure => measure.metric.key === 'ncloc') === undefined;

  renderLoading() {
    return (
      <div className="text-center">
        <i className="spinner spinner-margin" />
      </div>
    );
  }

  renderEmpty() {
    const { component } = this.props;
    const isProject = component.qualifier === 'TRK';
    return (
      <div className="overview-main page-main">
        <h3>
          {!this.state.measures ||
          !this.state.measures.find(measure => measure.metric.key === 'projects')
            ? translate(isProject ? 'overview.project.empty' : 'portfolio.app.empty')
            : translate(
                isProject ? 'overview.project.no_lines_of_code' : 'portfolio.app.no_lines_of_code'
              )}
        </h3>
      </div>
    );
  }

  renderMain() {
    const { branchLike, component } = this.props;
    const { periods, measures, history, historyStartDate } = this.state;
    const leakPeriod =
      component.qualifier === 'APP' ? this.getApplicationLeakPeriod() : getLeakPeriod(periods);
    const domainProps = {
      branchLike,
      component,
      measures,
      leakPeriod,
      history,
      historyStartDate
    };

    if (this.isEmpty()) {
      return this.renderEmpty();
    }

    return (
      <div className="overview-main page-main">
        {component.qualifier === 'APP' ? (
          <ApplicationQualityGate component={component} />
        ) : (
          <QualityGate branchLike={branchLike} component={component} measures={measures} />
        )}

        <div className="overview-domains-list">
          <BugsAndVulnerabilities {...domainProps} />
          <CodeSmells {...domainProps} />
          <Coverage {...domainProps} />
          <Duplications {...domainProps} />
        </div>
      </div>
    );
  }

  render() {
    const { branchLike, component } = this.props;
    const { loading, measures, history } = this.state;

    if (loading) {
      return this.renderLoading();
    }

    return (
      <div className="page page-limited">
        <div className="overview page-with-sidebar">
          <Helmet>
            <link href={getPathUrlAsString(getProjectUrl(component.key))} rel="canonical" />
          </Helmet>

          {this.renderMain()}

          <div className="overview-sidebar page-sidebar-fixed">
            <Meta
              branchLike={branchLike}
              component={component}
              history={history}
              measures={measures}
              metrics={this.props.metrics}
              onComponentChange={this.props.onComponentChange}
            />
          </div>
        </div>
      </div>
    );
  }
}

const mapDispatchToProps: DispatchToProps = { fetchMetrics };

const mapStateToProps = (state: any): StateToProps => ({
  metrics: getMetrics(state)
});

export default connect<StateToProps, DispatchToProps, OwnProps>(
  mapStateToProps,
  mapDispatchToProps
)(OverviewApp);
